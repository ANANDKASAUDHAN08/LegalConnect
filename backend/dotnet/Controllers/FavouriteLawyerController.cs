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
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
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

        // POST /api/favouritelawyer — save a lawyer
        [HttpPost]
        public async Task<IActionResult> AddFavourite([FromBody] AddFavouriteLawyerDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var exists = await _context.FavouriteLawyers.AnyAsync(f =>
                f.ClientId == userId && f.LawyerId == request.LawyerId);

            if (exists) return BadRequest(new { message = "Lawyer already saved." });

            _context.FavouriteLawyers.Add(new FavouriteLawyer
            {
                ClientId = userId,
                LawyerId = request.LawyerId,
                LawyerName = request.LawyerName ?? string.Empty,
                SavedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"{request.LawyerName} saved to your favourites!" });
        }

        // DELETE /api/favouritelawyer/{lawyerId} — remove a saved lawyer
        [HttpDelete("{lawyerId}")]
        public async Task<IActionResult> RemoveFavourite(string lawyerId)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var fav = await _context.FavouriteLawyers.FirstOrDefaultAsync(f =>
                f.ClientId == userId && f.LawyerId == lawyerId);

            if (fav == null) return NotFound(new { message = "Saved lawyer not found." });

            _context.FavouriteLawyers.Remove(fav);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Lawyer removed from favourites." });
        }
    }

    public class AddFavouriteLawyerDto
    {
        public string LawyerId { get; set; } = string.Empty;
        public string? LawyerName { get; set; }
    }
}