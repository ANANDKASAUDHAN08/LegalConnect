using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FeedbackController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FeedbackController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> SubmitFeedback([FromBody] SubmitFeedbackDto request)
        {
            if (string.IsNullOrWhiteSpace(request.PageSlug))
            {
                return BadRequest("PageSlug is required.");
            }

            int? userId = null;
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedId))
            {
                userId = parsedId;
            }

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var pageSlug = request.PageSlug.Trim().ToLowerInvariant();

            // Upsert: find existing feedback for this user/IP on this page
            var existing = await _context.PolicyFeedbacks
                .FirstOrDefaultAsync(f => f.PageSlug == pageSlug &&
                    ((userId.HasValue && f.UserId == userId) ||
                     (!userId.HasValue && f.IpAddress == ip)));

            if (existing != null)
            {
                // Update the existing record instead of creating a duplicate
                existing.IsHelpful = request.IsHelpful;
                existing.CreatedAt = DateTime.UtcNow;

                // Link account if they logged in after leaving anonymous feedback
                if (userId.HasValue && !existing.UserId.HasValue)
                {
                    existing.UserId = userId;
                }
            }
            else
            {
                // First-time feedback — create new record
                var feedback = new PolicyFeedback
                {
                    PageSlug = pageSlug,
                    IsHelpful = request.IsHelpful,
                    IpAddress = ip,
                    CreatedAt = DateTime.UtcNow,
                    UserId = userId
                };
                _context.PolicyFeedbacks.Add(feedback);
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Feedback recorded successfully.",
                isHelpful = request.IsHelpful,
                updatedAt = DateTime.UtcNow
            });
        }
    }

    public class SubmitFeedbackDto
    {
        public string PageSlug { get; set; } = string.Empty;
        public bool IsHelpful { get; set; }
    }
}