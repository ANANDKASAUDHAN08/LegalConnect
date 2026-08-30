using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
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

        // ─── Helper: Get authenticated user ID (returns null for guests) ───
        private int? GetUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null && int.TryParse(claim, out int uid) ? uid : null;
        }

        /// <summary>
        /// POST /api/interaction/toggle
        /// Atomic single-trip toggle: create → like, exists same type → unlike (delete),
        /// exists different type → flip. Requires authentication.
        /// </summary>
        [HttpPost("toggle")]
        [Authorize]
        public async Task<IActionResult> Toggle([FromBody] ToggleInteractionDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "Authentication required to interact." });

            if (string.IsNullOrWhiteSpace(dto.TargetType) || string.IsNullOrWhiteSpace(dto.TargetId))
                return BadRequest(new { message = "TargetType and TargetId are required." });

            InteractionType targetTypeEnum = InteractionType.Like;
            if (!string.IsNullOrWhiteSpace(dto.Type) && Enum.TryParse<InteractionType>(dto.Type, true, out var parsed))
            {
                targetTypeEnum = parsed;
            }

            try
            {
                var existing = await _context.UserInteractions
                    .FirstOrDefaultAsync(i =>
                        i.UserId == userId.Value &&
                        i.TargetType == dto.TargetType &&
                        i.TargetId == dto.TargetId);

                bool isNowActive;
                InteractionType finalType = targetTypeEnum;

                if (existing != null && existing.Type == targetTypeEnum)
                {
                    // Same type exists → remove (unlike/unhelpful)
                    _context.UserInteractions.Remove(existing);
                    isNowActive = false;
                }
                else if (existing != null && existing.Type != targetTypeEnum)
                {
                    // Different type exists → flip (e.g., Like → Dislike)
                    existing.Type = targetTypeEnum;
                    existing.UpdatedAt = DateTime.UtcNow;
                    isNowActive = true;
                }
                else
                {
                    // Not exists → create
                    _context.UserInteractions.Add(new UserInteraction
                    {
                        UserId = userId.Value,
                        TargetType = dto.TargetType.Trim(),
                        TargetId = dto.TargetId.Trim(),
                        Type = targetTypeEnum,
                        ClientIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                        CreatedAt = DateTime.UtcNow
                    });
                    isNowActive = true;
                }

                await _context.SaveChangesAsync();

                // Dual-write legacy count if applicable
                if (dto.TargetType == "Review" && int.TryParse(dto.TargetId, out int reviewId))
                {
                    var review = await _context.Reviews.FindAsync(reviewId);
                    if (review != null)
                    {
                        var newCount = await _context.UserInteractions
                            .CountAsync(i => i.TargetType == "Review" && i.TargetId == dto.TargetId && i.Type == InteractionType.Like);
                        review.Likes = newCount;
                        await _context.SaveChangesAsync();
                    }
                }

                // Query authoritative total count
                var totalCount = await _context.UserInteractions
                    .CountAsync(i => i.TargetType == dto.TargetType && i.TargetId == dto.TargetId && i.Type == targetTypeEnum);

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
                // Idempotent recovery on race conditions
                var current = await _context.UserInteractions
                    .FirstOrDefaultAsync(i =>
                        i.UserId == userId.Value &&
                        i.TargetType == dto.TargetType &&
                        i.TargetId == dto.TargetId);

                return Ok(new
                {
                    success = true,
                    active = current != null,
                    type = current?.Type.ToString() ?? targetTypeEnum.ToString(),
                    count = await _context.UserInteractions
                        .CountAsync(i => i.TargetType == dto.TargetType && i.TargetId == dto.TargetId && i.Type == targetTypeEnum)
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"InteractionToggle error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to process interaction." });
            }
        }

        /// <summary>
        /// POST /api/interaction/batch-status
        /// Returns interaction state for multiple target IDs in a single query.
        /// Works for both authenticated (includes personal vote) and guest (counts only) users.
        /// </summary>
        [HttpPost("batch-status")]
        [AllowAnonymous]
        public async Task<IActionResult> BatchStatus([FromBody] BatchStatusDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.TargetType) || dto.TargetIds == null || dto.TargetIds.Count == 0)
                return BadRequest(new { message = "TargetType and at least one TargetId required." });

            // Cap batch size to prevent abuse
            var ids = dto.TargetIds.Take(100).Distinct().ToList();

            try
            {
                // Get total counts per target (grouped)
                var countGroups = await _context.UserInteractions
                    .Where(i => i.TargetType == dto.TargetType && ids.Contains(i.TargetId) &&
                               (i.Type == InteractionType.Like || i.Type == InteractionType.Helpful))
                    .GroupBy(i => i.TargetId)
                    .Select(g => new { TargetId = g.Key, Count = g.Count() })
                    .ToListAsync();

                var countMap = countGroups.ToDictionary(g => g.TargetId, g => g.Count);

                // Get personal vote state if authenticated
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

                // Build response map
                var result = new Dictionary<string, object>();
                foreach (var id in ids)
                {
                    InteractionType userType = InteractionType.Like;
                    var hasPersonal = personalMap != null && personalMap.TryGetValue(id, out userType);
                    result[id] = new
                    {
                        count = countMap.TryGetValue(id, out int cnt) ? cnt : 0,
                        liked = hasPersonal,
                        type = hasPersonal ? userType.ToString() : null
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
        /// GET /api/interaction/count?targetType=Review&targetId=123
        /// Returns live count and type breakdown for a single item.
        /// </summary>
        [HttpGet("count")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCount([FromQuery] string targetType, [FromQuery] string targetId)
        {
            if (string.IsNullOrWhiteSpace(targetType) || string.IsNullOrWhiteSpace(targetId))
                return BadRequest(new { message = "TargetType and TargetId required." });

            var counts = await _context.UserInteractions
                .Where(i => i.TargetType == targetType && i.TargetId == targetId)
                .GroupBy(i => i.Type)
                .Select(g => new { Type = g.Key.ToString(), Count = g.Count() })
                .ToListAsync();

            var total = counts.Sum(c => c.Count);
            var userId = GetUserId();

            string? userInteraction = null;
            if (userId != null)
            {
                var personal = await _context.UserInteractions
                    .FirstOrDefaultAsync(i => i.UserId == userId.Value && i.TargetType == targetType && i.TargetId == targetId);
                userInteraction = personal?.Type.ToString();
            }

            return Ok(new
            {
                total,
                breakdown = counts,
                userInteraction,
                liked = userInteraction != null
            });
        }

        /// <summary>
        /// GET /api/interaction/my-interactions?targetType=Lawyer&page=1&limit=50
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

    // ── DTOs ──

    public class ToggleInteractionDto
    {
        public string TargetType { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string Type { get; set; } = "Like";
    }

    public class BatchStatusDto
    {
        public string TargetType { get; set; } = string.Empty;
        public List<string> TargetIds { get; set; } = new();
    }
}