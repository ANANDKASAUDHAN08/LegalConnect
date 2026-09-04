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
    /// <summary>
    /// DEPRECATED: Use UniversalBookmarkController instead.
    /// Thin backward-compatible facade that dual-writes to legacy + unified tables.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FavouriteResourceController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FavouriteResourceController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetFavourites()
        {
            Response.Headers.Append("X-Deprecated", "true");
            Response.Headers.Append("X-Migration-Target", "GET /api/universalbookmark?targetType=LegalResource");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var unified = await _context.UserBookmarks
                .Where(b => b.UserId == userId && b.TargetType == "LegalResource")
                .OrderByDescending(b => b.SavedAt)
                .Select(b => new
                {
                    resourceId = b.TargetId,
                    resourceName = b.Title,
                    savedAt = ((DateTimeOffset)b.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            if (unified.Any()) return Ok(unified);

            var saved = await _context.FavouriteResources
                .Where(f => f.ClientId == userId)
                .OrderByDescending(f => f.SavedAt)
                .Select(f => new
                {
                    resourceId = f.ResourceId,
                    resourceName = f.ResourceName,
                    savedAt = ((DateTimeOffset)f.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            return Ok(saved);
        }

        [HttpPost]
        public async Task<IActionResult> AddFavourite([FromBody] AddFavouriteResourceDto request)
        {
            Response.Headers.Append("X-Deprecated", "true");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var unifiedExists = await _context.UserBookmarks.AnyAsync(b =>
                b.UserId == userId && b.TargetType == "LegalResource" && b.TargetId == request.ResourceId);

            if (!unifiedExists)
            {
                _context.UserBookmarks.Add(new UserBookmark
                {
                    UserId = userId,
                    TargetType = "LegalResource",
                    TargetId = request.ResourceId,
                    Title = request.ResourceName ?? string.Empty,
                    CollectionName = "General",
                    SavedAt = DateTime.UtcNow
                });
            }

            var legacyExists = await _context.FavouriteResources.AnyAsync(f =>
                f.ClientId == userId && f.ResourceId == request.ResourceId);

            if (!legacyExists)
            {
                _context.FavouriteResources.Add(new FavouriteResource
                {
                    ClientId = userId,
                    ResourceId = request.ResourceId,
                    ResourceName = request.ResourceName ?? string.Empty,
                    SavedAt = DateTime.UtcNow
                });
            }

            if (unifiedExists && legacyExists)
                return BadRequest(new { message = "Resource already saved." });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{request.ResourceName} saved to your bookmarks!" });
        }

        [HttpDelete("{resourceId}")]
        public async Task<IActionResult> RemoveFavourite(string resourceId)
        {
            Response.Headers.Append("X-Deprecated", "true");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var unified = await _context.UserBookmarks.FirstOrDefaultAsync(b =>
                b.UserId == userId && b.TargetType == "LegalResource" && b.TargetId == resourceId);
            if (unified != null) _context.UserBookmarks.Remove(unified);

            var legacy = await _context.FavouriteResources.FirstOrDefaultAsync(f =>
                f.ClientId == userId && f.ResourceId == resourceId);
            if (legacy != null) _context.FavouriteResources.Remove(legacy);

            if (unified == null && legacy == null)
                return NotFound(new { message = "Saved resource not found." });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Resource removed from bookmarks." });
        }
    }
}