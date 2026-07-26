using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    public partial class AdminController : ControllerBase
    {
        // ═══════════════════════════════════════════════════════════════
        //  DASHBOARD & ANALYTICS STATS
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/overview")]
        public async Task<IActionResult> GetOverview()
        {
            var now = DateTime.UtcNow;
            var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var startOfLastMonth = startOfMonth.AddMonths(-1);

            var totalUsers = await _context.Users.CountAsync(u => u.IsActive);
            var usersThisMonth = await _context.Users.CountAsync(u => u.IsActive && u.CreatedAt >= startOfMonth);
            var usersLastMonth = await _context.Users.CountAsync(u => u.IsActive && u.CreatedAt >= startOfLastMonth && u.CreatedAt < startOfMonth);
            var userGrowth = usersLastMonth > 0 ? Math.Round((double)(usersThisMonth - usersLastMonth) / usersLastMonth * 100, 1) : 100.0;

            var totalLawyers = await _context.Users.CountAsync(u => u.Role == "Lawyer" && u.IsActive);
            var verifiedLawyers = await _context.LawyerProfiles.CountAsync(lp => lp.IsVerified);
            var pendingLawyers = totalLawyers - verifiedLawyers;

            var activeSessions = await _context.ActiveSessions.CountAsync();

            var reviews = await _context.Reviews.ToListAsync();
            var avgRating = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : 0.0;

            var totalConsultations = await _context.Consultations.CountAsync();
            var pendingConsultations = await _context.Consultations.CountAsync(c => c.Status == "Pending");

            var totalContacts = await _context.ContactSubmissions.CountAsync();
            var newContacts = await _context.ContactSubmissions.CountAsync(c => c.Status == "New");

            // Fetch real user tickets from Node.js MongoDB ticket service if available
            try
            {
                var nodeBaseUrl = _configuration["NodeServices:BaseUrl"] ?? "http://localhost:5000";
                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(3);
                var response = await httpClient.GetAsync($"{nodeBaseUrl}/api/legal/contact/all-tickets");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                    if (json.TryGetProperty("total", out var totalProp) && json.TryGetProperty("newCount", out var newCountProp))
                    {
                        var mongoTotal = totalProp.GetInt32();
                        var mongoNew = newCountProp.GetInt32();
                        totalContacts += mongoTotal;
                        newContacts += mongoNew;
                    }
                }
            }
            catch {}

            return Ok(new
            {
                totalUsers,
                usersThisMonth,
                userGrowth,
                totalLawyers,
                verifiedLawyers,
                pendingLawyers,
                activeSessions,
                avgRating,
                totalReviews = reviews.Count,
                totalConsultations,
                pendingConsultations,
                totalContacts,
                newContacts
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/registrations")]
        public async Task<IActionResult> GetRegistrationTrends()
        {
            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var users = await _context.Users
                .Where(u => u.CreatedAt >= thirtyDaysAgo)
                .ToListAsync();

            var daily = new List<object>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var count = users.Count(u => u.CreatedAt.Date == date);
                daily.Add(new { date = date.ToString("MMM dd"), count });
            }

            var roleDistribution = await _context.Users
                .Where(u => u.IsActive)
                .GroupBy(u => u.Role)
                .Select(g => new { role = g.Key, count = g.Count() })
                .ToListAsync();

            return Ok(new { daily, roleDistribution });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/logins")]
        public async Task<IActionResult> GetLoginTrends()
        {
            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var logins = await _context.LoginHistories
                .Where(l => l.LoginTime >= thirtyDaysAgo)
                .ToListAsync();

            var daily = new List<object>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var success = logins.Count(l => l.LoginTime.Date == date && l.Status == "Success");
                var failed = logins.Count(l => l.LoginTime.Date == date && l.Status == "Failed");
                daily.Add(new { date = date.ToString("MMM dd"), success, failed });
            }

            return Ok(new { daily });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/consultations")]
        public async Task<IActionResult> GetConsultationTrends()
        {
            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var consultations = await _context.Consultations
                .Where(c => c.CreatedAt >= thirtyDaysAgo)
                .ToListAsync();

            var daily = new List<object>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var count = consultations.Count(c => c.CreatedAt.Date == date);
                daily.Add(new { date = date.ToString("MMM dd"), count });
            }

            var statusDistribution = await _context.Consultations
                .GroupBy(c => c.Status)
                .Select(g => new { status = g.Key, count = g.Count() })
                .ToListAsync();

            return Ok(new { daily, statusDistribution });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/reviews")]
        public async Task<IActionResult> GetReviewStats()
        {
            var reviews = await _context.Reviews.ToListAsync();

            var ratingDistribution = Enumerable.Range(1, 5)
                .Select(r => new { rating = r, count = reviews.Count(rv => rv.Rating == r) })
                .ToList();

            var byRole = reviews.GroupBy(r => r.UserRole)
                .Select(g => new { role = g.Key, count = g.Count() })
                .ToList();

            return Ok(new { ratingDistribution, byRole, total = reviews.Count });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/cities")]
        public async Task<IActionResult> GetCityStats()
        {
            var userCities = await _context.Users
                .Where(u => u.IsActive && !string.IsNullOrEmpty(u.ClientCity))
                .GroupBy(u => u.ClientCity)
                .Select(g => new { city = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(10)
                .ToListAsync();

            var lawyerCities = await _context.LawyerProfiles
                .Where(lp => !string.IsNullOrEmpty(lp.City))
                .GroupBy(lp => lp.City)
                .Select(g => new { city = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(10)
                .ToListAsync();

            return Ok(new { userCities, lawyerCities });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/specializations")]
        public async Task<IActionResult> GetSpecializationStats()
        {
            var profiles = await _context.LawyerProfiles
                .Where(lp => !string.IsNullOrEmpty(lp.Specialization))
                .Select(lp => lp.Specialization)
                .ToListAsync();

            var specCounts = profiles
                .SelectMany(s => s.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
                .GroupBy(s => s)
                .Select(g => new { specialization = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(12)
                .ToList();

            return Ok(new { specCounts });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/consent")]
        public async Task<IActionResult> GetConsentStats()
        {
            var total = await _context.ConsentPreferences.CountAsync();
            var analyticsOptIn = await _context.ConsentPreferences.CountAsync(c => c.AnalyticsConsent);
            var marketingOptIn = await _context.ConsentPreferences.CountAsync(c => c.MarketingConsent);

            return Ok(new
            {
                total,
                analyticsOptIn,
                analyticsOptInRate = total > 0 ? Math.Round((double)analyticsOptIn / total * 100, 1) : 0,
                marketingOptIn,
                marketingOptInRate = total > 0 ? Math.Round((double)marketingOptIn / total * 100, 1) : 0
            });
        }
    }
}
