using System;
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

        // Authenticated: GET /api/helpline/favourites — returns saved helpline IDs for the user
        [HttpGet("favourites")]
        [Authorize]
        public async Task<IActionResult> GetFavourites()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
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

        // Authenticated: POST /api/helpline/favourites — save a helpline
        [HttpPost("favourites")]
        [Authorize]
        public async Task<IActionResult> AddFavourite([FromBody] AddFavouriteHelplineDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var exists = await _context.FavouriteHelplines.AnyAsync(f =>
                f.ClientId == userId && f.HelplineId == request.HelplineId);

            if (exists) return BadRequest(new { message = "Helpline already saved." });

            _context.FavouriteHelplines.Add(new FavouriteHelpline
            {
                ClientId = userId,
                HelplineId = request.HelplineId,
                HelplineName = request.HelplineName ?? string.Empty,
                SavedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{request.HelplineName} saved to your favourites!" });
        }

        // Authenticated: DELETE /api/helpline/favourites/{helplineId} — remove a helpline
        [HttpDelete("favourites/{helplineId}")]
        [Authorize]
        public async Task<IActionResult> RemoveFavourite(string helplineId)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var fav = await _context.FavouriteHelplines.FirstOrDefaultAsync(f =>
                f.ClientId == userId && f.HelplineId == helplineId);

            if (fav == null) return NotFound(new { message = "Saved helpline not found." });

            _context.FavouriteHelplines.Remove(fav);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Helpline removed from favourites." });
        }
    }

    public class AddFavouriteHelplineDto
    {
        public string HelplineId { get; set; } = string.Empty;
        public string? HelplineName { get; set; }
    }
}