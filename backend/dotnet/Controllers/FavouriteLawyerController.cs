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
    /// This controller is a thin backward-compatible facade that writes to both
    /// the legacy FavouriteLawyers table AND the new unified UserBookmarks table.
    /// Will be removed after full frontend migration to /api/universalbookmark.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FavouriteLawyerController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FavouriteLawyerController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/favouritelawyer — returns list of saved lawyer IDs for the user
        [HttpGet]
        public async Task<IActionResult> GetFavourites()
        {
            Response.Headers.Append("X-Deprecated", "true");
            Response.Headers.Append("X-Migration-Target", "GET /api/universalbookmark?targetType=Lawyer");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Read from unified table first, fallback to legacy
            var unified = await _context.UserBookmarks
                .Where(b => b.UserId == userId && b.TargetType == "Lawyer")
                .OrderByDescending(b => b.SavedAt)
                .Select(b => new
                {
                    lawyerId = b.TargetId,
                    lawyerName = b.Title,
                    savedAt = ((DateTimeOffset)b.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            if (unified.Any()) return Ok(unified);

            // Fallback to legacy table during migration
            var saved = await _context.FavouriteLawyers
                .Where(f => f.ClientId == userId)
                .OrderByDescending(f => f.SavedAt)
                .Select(f => new
                {
                    lawyerId = f.LawyerId,
                    lawyerName = f.LawyerName,
                    savedAt = ((DateTimeOffset)f.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            return Ok(saved);
        }

        // POST /api/favouritelawyer — save a lawyer (writes to BOTH legacy + unified)
        [HttpPost]
        public async Task<IActionResult> AddFavourite([FromBody] AddFavouriteLawyerDto request)
        {
            Response.Headers.Append("X-Deprecated", "true");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Write to unified table
            var unifiedExists = await _context.UserBookmarks.AnyAsync(b =>
                b.UserId == userId && b.TargetType == "Lawyer" && b.TargetId == request.LawyerId);

            if (!unifiedExists)
            {
                _context.UserBookmarks.Add(new UserBookmark
                {
                    UserId = userId,
                    TargetType = "Lawyer",
                    TargetId = request.LawyerId,
                    Title = request.LawyerName ?? string.Empty,
                    CollectionName = "General",
                    SavedAt = DateTime.UtcNow
                });
            }

            // Also write to legacy table for backward compat
            var legacyExists = await _context.FavouriteLawyers.AnyAsync(f =>
                f.ClientId == userId && f.LawyerId == request.LawyerId);

            if (!legacyExists)
            {
                _context.FavouriteLawyers.Add(new FavouriteLawyer
                {
                    ClientId = userId,
                    LawyerId = request.LawyerId,
                    LawyerName = request.LawyerName ?? string.Empty,
                    SavedAt = DateTime.UtcNow
                });
            }

            if (unifiedExists && legacyExists)
                return BadRequest(new { message = "Lawyer already saved." });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{request.LawyerName} saved to your favourites!" });
        }

        // DELETE /api/favouritelawyer/{lawyerId} — remove from BOTH tables
        [HttpDelete("{lawyerId}")]
        public async Task<IActionResult> RemoveFavourite(string lawyerId)
        {
            Response.Headers.Append("X-Deprecated", "true");

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Remove from unified
            var unified = await _context.UserBookmarks.FirstOrDefaultAsync(b =>
                b.UserId == userId && b.TargetType == "Lawyer" && b.TargetId == lawyerId);
            if (unified != null) _context.UserBookmarks.Remove(unified);

            // Remove from legacy
            var legacy = await _context.FavouriteLawyers.FirstOrDefaultAsync(f =>
                f.ClientId == userId && f.LawyerId == lawyerId);
            if (legacy != null) _context.FavouriteLawyers.Remove(legacy);

            if (unified == null && legacy == null)
                return NotFound(new { message = "Saved lawyer not found." });

            await _context.SaveChangesAsync();
            return Ok(new { message = "Lawyer removed from favourites." });
        }
    }
}