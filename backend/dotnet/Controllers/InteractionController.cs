using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.DTOs;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InteractionController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InteractionController(AppDbContext context)
        {
            _context = context;
        }

        // ─── Shared Helpers ───

        private int? GetUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null && int.TryParse(claim, out int uid) ? uid : null;
        }

        /// <summary>
        /// Gets or lazily creates the InteractionCounter for a given entity.
        /// Centralizes counter lookup so Toggle, BatchStatus, GetCount, and Enrich all share one path.
        /// </summary>
        private async Task<InteractionCounter> GetOrCreateCounterAsync(string targetType, string targetId)
        {
            var counter = await _context.InteractionCounters
                .FirstOrDefaultAsync(c => c.TargetType == targetType && c.TargetId == targetId);

            if (counter != null) return counter;

            // Lazy back-fill from source of truth
            var groups = await _context.UserInteractions
                .Where(i => i.TargetType == targetType && i.TargetId == targetId)
                .GroupBy(i => i.Type)
                .Select(g => new { Type = g.Key, Count = g.Count() })
                .ToListAsync();

            counter = new InteractionCounter
            {
                TargetType = targetType,
                TargetId = targetId,
                LikesCount = groups.FirstOrDefault(g => g.Type == InteractionType.Like)?.Count ?? 0,
                HelpfulCount = groups.FirstOrDefault(g => g.Type == InteractionType.Helpful)?.Count ?? 0,
                UpdatedAt = DateTime.UtcNow
            };

            _context.InteractionCounters.Add(counter);
            try { await _context.SaveChangesAsync(); }
            catch (DbUpdateException) { /* idempotent on concurrent insert */ }

            return counter;
        }

        /// <summary>
        /// Gets the personal interaction type for an authenticated user on a specific entity.
        /// Returns null if user is guest or has no interaction.
        /// </summary>
        private async Task<string?> GetPersonalInteractionAsync(int? userId, string targetType, string targetId)
        {
            if (!userId.HasValue) return null;
            var personal = await _context.UserInteractions
                .FirstOrDefaultAsync(i => i.UserId == userId.Value && i.TargetType == targetType && i.TargetId == targetId);
            return personal?.Type.ToString();
        }

        // ─── Endpoints ───

        /// <summary>
        /// POST /api/interaction/toggle
        /// Atomic toggle: create → like, same type → unlike (delete), different type → flip.
        /// </summary>
        [HttpPost("toggle")]
        [Authorize]
        public async Task<IActionResult> Toggle([FromBody] ToggleInteractionDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "Authentication required to interact." });

            if (string.IsNullOrWhiteSpace(dto.TargetType) || string.IsNullOrWhiteSpace(dto.TargetId))
                return BadRequest(new { message = "TargetType and TargetId are required." });

            var targetTypeEnum = InteractionType.Like;
            if (!string.IsNullOrWhiteSpace(dto.Type) && Enum.TryParse<InteractionType>(dto.Type, true, out var parsed))
            {
                targetTypeEnum = parsed;
            }

            var targetTypeStr = dto.TargetType.Trim();
            var targetIdStr = dto.TargetId.Trim();

            try
            {
                var existing = await _context.UserInteractions
                    .FirstOrDefaultAsync(i =>
                        i.UserId == userId.Value &&
                        i.TargetType == targetTypeStr &&
                        i.TargetId == targetIdStr);

                bool isNowActive;

                if (existing != null && existing.Type == targetTypeEnum)
                {
                    _context.UserInteractions.Remove(existing);
                    isNowActive = false;
                }
                else if (existing != null)
                {
                    existing.Type = targetTypeEnum;
                    existing.UpdatedAt = DateTime.UtcNow;
                    isNowActive = true;
                }
                else
                {
                    _context.UserInteractions.Add(new UserInteraction
                    {
                        UserId = userId.Value,
                        TargetType = targetTypeStr,
                        TargetId = targetIdStr,
                        Type = targetTypeEnum,
                        ClientIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                        CreatedAt = DateTime.UtcNow
                    });
                    isNowActive = true;
                }

                await _context.SaveChangesAsync();

                // Atomic counter update
                var counter = await GetOrCreateCounterAsync(targetTypeStr, targetIdStr);

                if (targetTypeEnum == InteractionType.Like)
                    counter.LikesCount = isNowActive ? counter.LikesCount + 1 : Math.Max(0, counter.LikesCount - 1);
                else if (targetTypeEnum == InteractionType.Helpful)
                    counter.HelpfulCount = isNowActive ? counter.HelpfulCount + 1 : Math.Max(0, counter.HelpfulCount - 1);

                counter.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Dual-write legacy count for Review entities
                if (targetTypeStr == "Review" && int.TryParse(targetIdStr, out int reviewId))
                {
                    var review = await _context.Reviews.FindAsync(reviewId);
                    if (review != null)
                    {
                        review.Likes = counter.LikesCount;
                        await _context.SaveChangesAsync();
                    }
                }

                var totalCount = targetTypeEnum == InteractionType.Like ? counter.LikesCount : counter.HelpfulCount;

                return Ok(new
                {
                    success = true,
                    active = isNowActive,
                    type = targetTypeEnum.ToString(),
                    count = totalCount,
                    message = isNowActive ? "Interaction recorded." : "Interaction removed."
                });
            }
            catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("Duplicate") == true ||
                                                 ex.InnerException?.Message.Contains("UNIQUE") == true)
            {
                var current = await _context.UserInteractions
                    .FirstOrDefaultAsync(i =>
                        i.UserId == userId.Value &&
                        i.TargetType == targetTypeStr &&
                        i.TargetId == targetIdStr);

                var counter = await _context.InteractionCounters
                    .FirstOrDefaultAsync(c => c.TargetType == targetTypeStr && c.TargetId == targetIdStr);

                return Ok(new
                {
                    success = true,
                    active = current != null,
                    type = current?.Type.ToString() ?? targetTypeEnum.ToString(),
                    count = counter?.LikesCount ?? 0
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"InteractionToggle error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to process interaction." });
            }
        }

        /// <summary>
        /// GET /api/interaction/enrich?targetType=Lawyer&amp;targetId=123&amp;userId=456
        /// Returns { count, liked, saved } for server-side payload enrichment (consumed by Node.js).
        /// </summary>
        [HttpGet("enrich")]
        [AllowAnonymous]
        public async Task<IActionResult> Enrich(
            [FromQuery] string targetType,
            [FromQuery] string targetId,
            [FromQuery] int? userId = null)
        {
            if (string.IsNullOrWhiteSpace(targetType) || string.IsNullOrWhiteSpace(targetId))
                return BadRequest(new { message = "TargetType and TargetId are required." });

            var effectiveUserId = userId ?? GetUserId();
            var trimmedType = targetType.Trim();
            var trimmedId = targetId.Trim();

            var counter = await GetOrCreateCounterAsync(trimmedType, trimmedId);

            bool isLiked = false;
            bool isBookmarked = false;

            if (effectiveUserId.HasValue)
            {
                isLiked = await _context.UserInteractions
                    .AnyAsync(i => i.UserId == effectiveUserId.Value &&
                                   i.TargetType == trimmedType &&
                                   i.TargetId == trimmedId &&
                                   i.Type == InteractionType.Like);

                isBookmarked = await _context.UserBookmarks
                    .AnyAsync(b => b.UserId == effectiveUserId.Value &&
                                   b.TargetType == trimmedType &&
                                   b.TargetId == trimmedId);
            }

            return Ok(new
            {
                success = true,
                targetType = trimmedType,
                targetId = trimmedId,
                count = counter.LikesCount,
                liked = isLiked,
                saved = isBookmarked
            });
        }

        /// <summary>
        /// POST /api/interaction/batch-status
        /// Returns interaction state for multiple target IDs in a single query.
        /// </summary>
        [HttpPost("batch-status")]
        [AllowAnonymous]
        public async Task<IActionResult> BatchStatus([FromBody] BatchStatusDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.TargetType) || dto.TargetIds == null || dto.TargetIds.Count == 0)
                return BadRequest(new { message = "TargetType and at least one TargetId required." });

            var ids = dto.TargetIds.Take(100).Distinct().ToList();

            try
            {
                // Batch read from InteractionCounters
                var cachedCounters = await _context.InteractionCounters
                    .Where(c => c.TargetType == dto.TargetType && ids.Contains(c.TargetId))
                    .ToListAsync();

                var countMap = cachedCounters.ToDictionary(
                    c => c.TargetId,
                    c => c.LikesCount > 0 ? c.LikesCount : c.HelpfulCount);

                // Lazy back-fill missing IDs
                var missingIds = ids.Where(id => !countMap.ContainsKey(id)).ToList();
                if (missingIds.Any())
                {
                    var missingGroups = await _context.UserInteractions
                        .Where(i => i.TargetType == dto.TargetType && missingIds.Contains(i.TargetId) &&
                                   (i.Type == InteractionType.Like || i.Type == InteractionType.Helpful))
                        .GroupBy(i => i.TargetId)
                        .Select(g => new { TargetId = g.Key, Count = g.Count() })
                        .ToListAsync();

                    foreach (var g in missingGroups)
                    {
                        countMap[g.TargetId] = g.Count;
                        _context.InteractionCounters.Add(new InteractionCounter
                        {
                            TargetType = dto.TargetType,
                            TargetId = g.TargetId,
                            LikesCount = g.Count,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                    if (missingGroups.Any())
                    {
                        try { await _context.SaveChangesAsync(); } catch { /* idempotent */ }
                    }
                }

                // Personal vote state
                var userId = GetUserId();
                Dictionary<string, InteractionType>? personalMap = null;

                if (userId != null)
                {
                    var personal = await _context.UserInteractions
                        .Where(i => i.UserId == userId.Value && i.TargetType == dto.TargetType && ids.Contains(i.TargetId))
                        .Select(i => new { i.TargetId, i.Type })
                        .ToListAsync();

                    personalMap = personal.ToDictionary(p => p.TargetId, p => p.Type);
                }

                var result = new Dictionary<string, object>();
                foreach (var id in ids)
                {
                    InteractionType userType = InteractionType.Like;
                    var hasPersonal = personalMap != null && personalMap.TryGetValue(id, out userType);
                    result[id] = new
                    {
                        count = countMap.TryGetValue(id, out int cnt) ? cnt : 0,
                        liked = hasPersonal,
                        type = hasPersonal ? userType.ToString() : (string?)null
                    };
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"InteractionBatchStatus error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to fetch interaction statuses." });
            }
        }

        /// <summary>
        /// GET /api/interaction/count?targetType=Review&amp;targetId=123
        /// Returns cached count from InteractionCounters with personal vote state.
        /// </summary>
        [HttpGet("count")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCount([FromQuery] string targetType, [FromQuery] string targetId)
        {
            if (string.IsNullOrWhiteSpace(targetType) || string.IsNullOrWhiteSpace(targetId))
                return BadRequest(new { message = "TargetType and TargetId required." });

            var trimmedType = targetType.Trim();
            var trimmedId = targetId.Trim();

            var counter = await GetOrCreateCounterAsync(trimmedType, trimmedId);
            var total = counter.LikesCount + counter.HelpfulCount;
            var userInteraction = await GetPersonalInteractionAsync(GetUserId(), trimmedType, trimmedId);

            return Ok(new
            {
                total,
                breakdown = new[]
                {
                    new { Type = "Like", Count = counter.LikesCount },
                    new { Type = "Helpful", Count = counter.HelpfulCount }
                }.Where(b => b.Count > 0),
                userInteraction,
                liked = userInteraction != null
            });
        }

        /// <summary>
        /// GET /api/interaction/my-interactions?targetType=Lawyer&amp;page=1&amp;limit=50
        /// Returns all items the current user has liked/interacted with.
        /// </summary>
        [HttpGet("my-interactions")]
        [Authorize]
        public async Task<IActionResult> GetMyInteractions(
            [FromQuery] string? targetType,
            [FromQuery] int page = 1,
            [FromQuery] int limit = 50)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var query = _context.UserInteractions
                .Where(i => i.UserId == userId.Value);

            if (!string.IsNullOrWhiteSpace(targetType))
                query = query.Where(i => i.TargetType == targetType);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(i => i.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(i => new
                {
                    i.Id,
                    i.TargetType,
                    i.TargetId,
                    type = i.Type.ToString(),
                    i.CreatedAt
                })
                .ToListAsync();

            return Ok(new { data = items, total, page, limit });
        }
    }
}