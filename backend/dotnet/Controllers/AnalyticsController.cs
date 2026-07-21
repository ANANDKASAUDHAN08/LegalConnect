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
    public class AnalyticsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AnalyticsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("profile-view")]
        public async Task<IActionResult> TrackProfileView([FromBody] TrackViewDto request)
        {
            int lawyerId = request.LawyerId;
            if (lawyerId <= 0 && !string.IsNullOrEmpty(request.LawyerEmail))
            {
                var lawyerUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.LawyerEmail);
                if (lawyerUser != null)
                {
                    lawyerId = lawyerUser.Id;
                }
            }

            if (lawyerId <= 0)
            {
                return BadRequest("Valid LawyerId or LawyerEmail is required.");
            }

            int? viewerUserId = null;
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedId))
            {
                viewerUserId = parsedId;
            }

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var userAgent = Request.Headers["User-Agent"].ToString();
            if (userAgent.Length > 500) userAgent = userAgent.Substring(0, 500);

            // Deduplicate: Don't track if same IP or viewerUserId viewed this lawyer within last 24 hours
            var cutoff = DateTime.UtcNow.AddHours(-24);
            var recentViewExists = await _context.Set<ProfileView>()
                .AnyAsync(v => v.LawyerId == lawyerId &&
                               ((viewerUserId.HasValue && v.ViewerUserId == viewerUserId) || (!string.IsNullOrEmpty(ip) && v.IpAddress == ip)) &&
                               v.ViewedAt >= cutoff);

            if (!recentViewExists)
            {
                var view = new ProfileView
                {
                    LawyerId = lawyerId,
                    ViewerUserId = viewerUserId,
                    IpAddress = ip,
                    UserAgent = userAgent,
                    ViewedAt = DateTime.UtcNow
                };
                _context.Set<ProfileView>().Add(view);
                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true });
        }

        [Authorize(Roles = "Lawyer")]
        [HttpGet("my-stats")]
        public async Task<IActionResult> GetMyStats()
        {
            var lawyerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var totalViews = await _context.Set<ProfileView>()
                .CountAsync(v => v.LawyerId == lawyerId);

            var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var viewsThisMonth = await _context.Set<ProfileView>()
                .CountAsync(v => v.LawyerId == lawyerId && v.ViewedAt >= startOfMonth);

            // 30-day views trend
            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var recentViews = await _context.Set<ProfileView>()
                .Where(v => v.LawyerId == lawyerId && v.ViewedAt >= thirtyDaysAgo)
                .ToListAsync();

            var dailyViews = new List<DailyStatDto>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var count = recentViews.Count(v => v.ViewedAt.Date == date);
                dailyViews.Add(new DailyStatDto
                {
                    Date = date.ToString("MMM dd"),
                    Count = count
                });
            }

            // Consultations metrics
            var totalInquiries = await _context.Consultations
                .CountAsync(c => c.LawyerId == lawyerId);

            var conversionRate = totalViews > 0 ? Math.Round((double)totalInquiries / totalViews * 100, 1) : 0.0;

            // Average rating calculation from Reviews table
            var lawyerProfile = await _context.LawyerProfiles.Include(p => p.User).FirstOrDefaultAsync(p => p.UserId == lawyerId);
            var lawyerName = lawyerProfile?.User?.FullName ?? "";
            
            var reviews = await _context.Reviews
                .Where(r => r.TargetName == lawyerName || r.TargetName == "Platform")
                .ToListAsync();

            var avgRating = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : 4.8;
            var totalReviewsCount = reviews.Count;

            return Ok(new
            {
                totalViews,
                viewsThisMonth,
                totalInquiries,
                conversionRate,
                averageRating = avgRating,
                totalReviews = totalReviewsCount,
                dailyViews
            });
        }
    }

    public class TrackViewDto
    {
        public int LawyerId { get; set; }
        public string? LawyerEmail { get; set; }
    }

    public class DailyStatDto
    {
        public string Date { get; set; } = string.Empty;
        public int Count { get; set; }
    }
}