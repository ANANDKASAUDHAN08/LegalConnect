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
    [Authorize]
    public class FavouriteResourceController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FavouriteResourceController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/favouriteresource — returns list of saved resource IDs for the user
        [HttpGet]
        public async Task<IActionResult> GetFavourites()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
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

        // POST /api/favouriteresource — save a resource
        [HttpPost]
        public async Task<IActionResult> AddFavourite([FromBody] AddFavouriteResourceDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var exists = await _context.FavouriteResources.AnyAsync(f =>
                f.ClientId == userId && f.ResourceId == request.ResourceId);

            if (exists) return BadRequest(new { message = "Resource already saved." });

            _context.FavouriteResources.Add(new FavouriteResource
            {
                ClientId = userId,
                ResourceId = request.ResourceId,
                ResourceName = request.ResourceName ?? string.Empty,
                SavedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{request.ResourceName} saved to your bookmarks!" });
        }

        // DELETE /api/favouriteresource/{resourceId} — remove a saved resource
        [HttpDelete("{resourceId}")]
        public async Task<IActionResult> RemoveFavourite(string resourceId)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var fav = await _context.FavouriteResources.FirstOrDefaultAsync(f =>
                f.ClientId == userId && f.ResourceId == resourceId);

            if (fav == null) return NotFound(new { message = "Saved resource not found." });

            _context.FavouriteResources.Remove(fav);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Resource removed from bookmarks." });
        }
    }

    public class AddFavouriteResourceDto
    {
        public string ResourceId { get; set; } = string.Empty;
        public string? ResourceName { get; set; }
    }
}