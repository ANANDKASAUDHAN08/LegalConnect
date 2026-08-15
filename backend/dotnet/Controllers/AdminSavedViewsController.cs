using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [Route("api/admin/[controller]")]
    [ApiController]
    [Authorize]
    public class AdminSavedViewsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminSavedViewsController(AppDbContext context)
        {
            _context = context;
        }

        private int GetCurrentUserId()
        {
            var val = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                   ?? User.FindFirst("nameid")?.Value
                   ?? User.FindFirst("sub")?.Value
                   ?? User.FindFirst("id")?.Value
                   ?? User.FindFirst("userId")?.Value;
            if (int.TryParse(val, out int userId))
            {
                return userId;
            }
            return 0;
        }

        [HttpGet]
        public async Task<IActionResult> GetSavedViews([FromQuery] string pageKey)
        {
            if (string.IsNullOrWhiteSpace(pageKey))
            {
                return BadRequest(new { success = false, message = "pageKey parameter is required." });
            }

            var userId = GetCurrentUserId();
            var views = await _context.AdminSavedViews
                .Where(v => v.UserId == userId && v.PageKey.ToLower() == pageKey.ToLower())
                .OrderByDescending(v => v.CreatedAt)
                .Select(v => new
                {
                    v.Id,
                    v.PageKey,
                    v.Name,
                    v.ParamsJson,
                    v.IsDefault,
                    v.CreatedAt,
                    v.UpdatedAt
                })
                .ToListAsync();

            return Ok(new { success = true, data = views });
        }

        [HttpPost]
        public async Task<IActionResult> CreateOrUpdateSavedView([FromBody] CreateAdminSavedViewDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetCurrentUserId();
            if (userId <= 0)
            {
                return Unauthorized(new { success = false, message = "Invalid or unauthenticated user session." });
            }

            var existing = await _context.AdminSavedViews
                .FirstOrDefaultAsync(v => v.UserId == userId && v.PageKey.ToLower() == dto.PageKey.ToLower() && v.Name.ToLower() == dto.Name.Trim().ToLower());

            if (existing != null)
            {
                existing.ParamsJson = dto.ParamsJson;
                existing.UpdatedAt = DateTime.UtcNow;
                _context.AdminSavedViews.Update(existing);
                await _context.SaveChangesAsync();
                return Ok(new { success = true, message = "Saved view updated successfully.", data = existing });
            }

            var newViewCount = await _context.AdminSavedViews
                .CountAsync(v => v.UserId == userId && v.PageKey.ToLower() == dto.PageKey.ToLower());
            if (newViewCount >= 20)
            {
                return BadRequest(new { success = false, message = "Maximum of 20 saved views per page reached. Please delete an existing view first." });
            }

            var newView = new AdminSavedView
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                PageKey = dto.PageKey.Trim(),
                Name = dto.Name.Trim(),
                ParamsJson = dto.ParamsJson,
                IsDefault = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.AdminSavedViews.Add(newView);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Saved view created successfully.", data = newView });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSavedView(Guid id)
        {
            var userId = GetCurrentUserId();
            var view = await _context.AdminSavedViews.FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId);

            if (view == null)
            {
                return NotFound(new { success = false, message = "Saved view not found or unauthorized." });
            }

            _context.AdminSavedViews.Remove(view);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Saved view deleted successfully." });
        }
    }
}