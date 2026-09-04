using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
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
    public class UniversalBookmarkController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UniversalBookmarkController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null && int.TryParse(claim, out int uid) ? uid : null;
        }

        /// <summary>
        /// GET /api/universalbookmark?targetType=Lawyer&collectionName=General&search=&page=1&pageSize=20
        /// Returns paginated bookmarks for the authenticated user.
        /// </summary>
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetBookmarks(
            [FromQuery] string? targetType,
            [FromQuery] string? collectionName,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "Authentication required." });

            var query = _context.UserBookmarks.Where(b => b.UserId == userId.Value);

            if (!string.IsNullOrWhiteSpace(targetType))
                query = query.Where(b => b.TargetType == targetType);

            if (!string.IsNullOrWhiteSpace(collectionName))
                query = query.Where(b => b.CollectionName == collectionName);

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(b =>
                    b.Title.Contains(search) ||
                    (b.Subtitle != null && b.Subtitle.Contains(search)) ||
                    (b.CustomNotes != null && b.CustomNotes.Contains(search)));

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(b => b.SavedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(b => new
                {
                    b.Id,
                    b.TargetType,
                    b.TargetId,
                    b.Title,
                    b.Subtitle,
                    b.CustomNotes,
                    b.CollectionName,
                    b.MetadataJson,
                    savedAt = ((DateTimeOffset)b.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                data = items,
                pagination = new { totalItems = total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize) }
            });
        }

        /// <summary>
        /// POST /api/universalbookmark/toggle
        /// Toggle bookmark: exists → remove, not exists → create.
        /// </summary>
        [HttpPost("toggle")]
        [Authorize]
        public async Task<IActionResult> Toggle([FromBody] ToggleBookmarkDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.TargetType) || string.IsNullOrWhiteSpace(dto.TargetId))
                return BadRequest(new { message = "TargetType and TargetId are required." });

            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "Authentication required." });

            try
            {
                var existing = await _context.UserBookmarks
                    .FirstOrDefaultAsync(b =>
                        b.UserId == userId.Value &&
                        b.TargetType == dto.TargetType &&
                        b.TargetId == dto.TargetId);

                if (existing != null)
                {
                    // Already saved → remove
                    _context.UserBookmarks.Remove(existing);
                    await _context.SaveChangesAsync();
                    return Ok(new { success = true, saved = false, message = "Removed from bookmarks." });
                }

                // Not saved → create
                var bookmark = new UserBookmark
                {
                    UserId = userId.Value,
                    TargetType = dto.TargetType.Trim(),
                    TargetId = dto.TargetId.Trim(),
                    Title = (dto.Title ?? "Untitled").Trim(),
                    Subtitle = dto.Subtitle?.Trim(),
                    CollectionName = string.IsNullOrWhiteSpace(dto.CollectionName) ? "General" : dto.CollectionName.Trim(),
                    MetadataJson = dto.MetadataJson,
                    SavedAt = DateTime.UtcNow
                };

                _context.UserBookmarks.Add(bookmark);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    saved = true,
                    message = $"Saved to {bookmark.CollectionName}.",
                    bookmark = new
                    {
                        bookmark.Id,
                        bookmark.TargetType,
                        bookmark.TargetId,
                        bookmark.Title,
                        bookmark.Subtitle,
                        bookmark.CollectionName,
                        bookmark.MetadataJson,
                        savedAt = ((DateTimeOffset)bookmark.SavedAt).ToUnixTimeMilliseconds()
                    }
                });
            }
            catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("Duplicate") == true ||
                                                 ex.InnerException?.Message.Contains("UNIQUE") == true)
            {
                return Ok(new { success = true, saved = true, message = "Already saved." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"BookmarkToggle error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to toggle bookmark." });
            }
        }

        /// <summary>
        /// PUT /api/universalbookmark/{id}
        /// Update notes, collectionName, or metadata of an existing bookmark.
        /// </summary>
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(long id, [FromBody] UpdateUniversalBookmarkDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "Authentication required." });

            var bookmark = await _context.UserBookmarks
                .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId.Value);

            if (bookmark == null)
                return NotFound(new { message = "Bookmark not found." });

            if (dto.CustomNotes != null) bookmark.CustomNotes = dto.CustomNotes.Trim();
            if (dto.CollectionName != null) bookmark.CollectionName = dto.CollectionName.Trim();
            if (dto.MetadataJson != null) bookmark.MetadataJson = dto.MetadataJson;

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Bookmark updated." });
        }

        /// <summary>
        /// DELETE /api/universalbookmark/{id}
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(long id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "Authentication required." });

            var bookmark = await _context.UserBookmarks
                .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId.Value);

            if (bookmark == null)
                return NotFound(new { message = "Bookmark not found." });

            _context.UserBookmarks.Remove(bookmark);
            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Bookmark removed." });
        }

        /// <summary>
        /// GET /api/universalbookmark/collections
        /// Returns distinct collection names with counts for the authenticated user.
        /// </summary>
        [HttpGet("collections")]
        [Authorize]
        public async Task<IActionResult> GetCollections()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "Authentication required." });

            var collections = await _context.UserBookmarks
                .Where(b => b.UserId == userId.Value)
                .GroupBy(b => b.CollectionName)
                .Select(g => new { name = g.Key, count = g.Count() })
                .OrderByDescending(g => g.count)
                .ToListAsync();

            return Ok(collections);
        }

        /// <summary>
        /// POST /api/universalbookmark/batch-status
        /// Returns saved state for multiple target IDs in a single query.
        /// Open to anonymous users (returns all false for guests).
        /// </summary>
        [HttpPost("batch-status")]
        [AllowAnonymous]
        public async Task<IActionResult> BatchStatus([FromBody] BookmarkBatchStatusDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.TargetType) || dto.TargetIds == null || dto.TargetIds.Count == 0)
                return BadRequest(new { message = "TargetType and at least one TargetId required." });

            var userId = GetUserId();
            var ids = dto.TargetIds.Take(100).Distinct().ToList();
            var result = new Dictionary<string, object>();

            if (userId == null)
            {
                // Guest user: none are saved on server
                foreach (var id in ids)
                {
                    result[id] = new { saved = false };
                }
                return Ok(result);
            }

            var savedIds = await _context.UserBookmarks
                .Where(b => b.UserId == userId.Value && b.TargetType == dto.TargetType && ids.Contains(b.TargetId))
                .Select(b => b.TargetId)
                .ToListAsync();

            var savedSet = new HashSet<string>(savedIds);

            foreach (var id in ids)
            {
                result[id] = new { saved = savedSet.Contains(id) };
            }

            return Ok(result);
        }
    }
}