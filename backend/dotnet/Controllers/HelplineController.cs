using System;
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
    public class HelplineController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HelplineController(AppDbContext context)
        {
            _context = context;
        }

        // Public: GET /api/helpline — returns all active helplines (from SQL)
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var helplines = await _context.Helplines
                .Where(h => h.IsActive)
                .OrderBy(h => h.Id)
                .Select(h => new
                {
                    id = h.Id,
                    name = h.Name,
                    number = h.Number,
                    description = h.Description,
                    categories = h.Categories.Split(',', StringSplitOptions.RemoveEmptyEntries)
                })
                .ToListAsync();

            return Ok(helplines);
        }

        /// <summary>
        /// DEPRECATED: Use GET /api/universalbookmark?targetType=Helpline instead.
        /// </summary>
        [HttpGet("favourites")]
        [Authorize]
        public async Task<IActionResult> GetFavourites()
        {
            Response.Headers.Append("X-Deprecated", "true");
            Response.Headers.Append("X-Migration-Target", "GET /api/universalbookmark?targetType=Helpline");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Read from unified first
            var unified = await _context.UserBookmarks
                .Where(b => b.UserId == userId && b.TargetType == "Helpline")
                .OrderByDescending(b => b.SavedAt)
                .Select(b => new
                {
                    helplineId = b.TargetId,
                    helplineName = b.Title,
                    savedAt = ((DateTimeOffset)b.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            if (unified.Any()) return Ok(unified);

            // Fallback to legacy
            var saved = await _context.FavouriteHelplines
                .Where(f => f.ClientId == userId)
                .OrderByDescending(f => f.SavedAt)
                .Select(f => new
                {
                    helplineId = f.HelplineId,
                    helplineName = f.HelplineName,
                    savedAt = ((DateTimeOffset)f.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            return Ok(saved);
        }

        /// <summary>
        /// DEPRECATED: Use POST /api/universalbookmark/toggle instead.
        /// </summary>
        [HttpPost("favourites")]
        [Authorize]
        public async Task<IActionResult> AddFavourite([FromBody] AddFavouriteHelplineDto request)
        {
            Response.Headers.Append("X-Deprecated", "true");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Write to unified
            var unifiedExists = await _context.UserBookmarks.AnyAsync(b =>
                b.UserId == userId && b.TargetType == "Helpline" && b.TargetId == request.HelplineId);

            if (!unifiedExists)
            {
                _context.UserBookmarks.Add(new UserBookmark
                {
                    UserId = userId,
                    TargetType = "Helpline",
                    TargetId = request.HelplineId,
                    Title = request.HelplineName ?? string.Empty,
                    CollectionName = "General",
                    SavedAt = DateTime.UtcNow
                });
            }

            // Also write to legacy
            var legacyExists = await _context.FavouriteHelplines.AnyAsync(f =>
                f.ClientId == userId && f.HelplineId == request.HelplineId);

            if (!legacyExists)
            {
                _context.FavouriteHelplines.Add(new FavouriteHelpline
                {
                    ClientId = userId,
                    HelplineId = request.HelplineId,
                    HelplineName = request.HelplineName ?? string.Empty,
                    SavedAt = DateTime.UtcNow
                });
            }

            if (unifiedExists && legacyExists)
                return BadRequest(new { message = "Helpline already saved." });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{request.HelplineName} saved to your favourites!" });
        }

        /// <summary>
        /// DEPRECATED: Use POST /api/universalbookmark/toggle instead.
        /// </summary>
        [HttpDelete("favourites/{helplineId}")]
        [Authorize]
        public async Task<IActionResult> RemoveFavourite(string helplineId)
        {
            Response.Headers.Append("X-Deprecated", "true");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var unified = await _context.UserBookmarks.FirstOrDefaultAsync(b =>
                b.UserId == userId && b.TargetType == "Helpline" && b.TargetId == helplineId);
            if (unified != null) _context.UserBookmarks.Remove(unified);

            var legacy = await _context.FavouriteHelplines.FirstOrDefaultAsync(f =>
                f.ClientId == userId && f.HelplineId == helplineId);
            if (legacy != null) _context.FavouriteHelplines.Remove(legacy);

            if (unified == null && legacy == null)
                return NotFound(new { message = "Saved helpline not found." });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Helpline removed from favourites." });
        }
    }
}