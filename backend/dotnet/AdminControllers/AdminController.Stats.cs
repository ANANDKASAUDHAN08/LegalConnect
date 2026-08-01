using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

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
            if (_cache.TryGetValue("DashboardOverviewSummary", out object? cachedOverview) && cachedOverview != null)
            {
                return Ok(cachedOverview);
            }

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

            var totalReviews = await _context.Reviews.CountAsync();
            var avgRatingRaw = totalReviews > 0 ? await _context.Reviews.Select(r => (double?)r.Rating).AverageAsync() : 0.0;
            var avgRating = Math.Round(avgRatingRaw ?? 0.0, 1);

            var totalConsultations = await _context.Consultations.CountAsync();
            var pendingConsultations = await _context.Consultations.CountAsync(c => c.Status == "Pending");

            var totalContacts = await _context.ContactSubmissions.CountAsync();
            var newContacts = await _context.ContactSubmissions.CountAsync(c => c.Status == "New");

            // Fetch real user tickets from Node.js MongoDB ticket service if available
            try
            {
                var nodeBaseUrl = _configuration["NodeServices:BaseUrl"] ?? "http://localhost:5000";
                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(2);
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

            var overviewResult = new
            {
                totalUsers,
                usersThisMonth,
                userGrowth,
                totalLawyers,
                verifiedLawyers,
                pendingLawyers,
                activeSessions,
                avgRating,
                totalReviews,
                totalConsultations,
                pendingConsultations,
                totalContacts,
                newContacts
            };

            _cache.Set("DashboardOverviewSummary", overviewResult, TimeSpan.FromSeconds(60));
            return Ok(overviewResult);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/registrations")]
        public async Task<IActionResult> GetRegistrationTrends()
        {
            if (_cache.TryGetValue("DashboardRegTrends", out object? cachedReg) && cachedReg != null)
            {
                return Ok(cachedReg);
            }

            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var users = await _context.Users
                .AsNoTracking()
                .Where(u => u.CreatedAt >= thirtyDaysAgo)
                .Select(u => u.CreatedAt)
                .ToListAsync();

            var daily = new List<object>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var count = users.Count(u => u.Date == date);
                daily.Add(new { date = date.ToString("MMM dd"), count });
            }

            var roleDistribution = await _context.Users
                .AsNoTracking()
                .Where(u => u.IsActive)
                .GroupBy(u => u.Role)
                .Select(g => new { role = g.Key, count = g.Count() })
                .ToListAsync();

            var result = new { daily, roleDistribution };
            _cache.Set("DashboardRegTrends", result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/logins")]
        public async Task<IActionResult> GetLoginTrends()
        {
            if (_cache.TryGetValue("DashboardLoginTrends", out object? cachedLogins) && cachedLogins != null)
            {
                return Ok(cachedLogins);
            }

            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var logins = await _context.LoginHistories
                .AsNoTracking()
                .Where(l => l.LoginTime >= thirtyDaysAgo)
                .Select(l => new { l.LoginTime, l.Status })
                .ToListAsync();

            var daily = new List<object>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var success = logins.Count(l => l.LoginTime.Date == date && l.Status == "Success");
                var failed = logins.Count(l => l.LoginTime.Date == date && l.Status == "Failed");
                daily.Add(new { date = date.ToString("MMM dd"), success, failed });
            }

            var result = new { daily };
            _cache.Set("DashboardLoginTrends", result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/consultations")]
        public async Task<IActionResult> GetConsultationTrends()
        {
            if (_cache.TryGetValue("DashboardConsultationTrends", out object? cachedConsultations) && cachedConsultations != null)
            {
                return Ok(cachedConsultations);
            }

            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var consultations = await _context.Consultations
                .AsNoTracking()
                .Where(c => c.CreatedAt >= thirtyDaysAgo)
                .Select(c => c.CreatedAt)
                .ToListAsync();

            var daily = new List<object>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var count = consultations.Count(c => c.Date == date);
                daily.Add(new { date = date.ToString("MMM dd"), count });
            }

            var statusDistribution = await _context.Consultations
                .AsNoTracking()
                .GroupBy(c => c.Status)
                .Select(g => new { status = g.Key, count = g.Count() })
                .ToListAsync();

            var result = new { daily, statusDistribution };
            _cache.Set("DashboardConsultationTrends", result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/reviews")]
        public async Task<IActionResult> GetReviewStats()
        {
            if (_cache.TryGetValue("DashboardReviewStats", out object? cachedReviews) && cachedReviews != null)
            {
                return Ok(cachedReviews);
            }

            var total = await _context.Reviews.CountAsync();
            var ratingCounts = await _context.Reviews
                .AsNoTracking()
                .GroupBy(r => r.Rating)
                .Select(g => new { rating = g.Key, count = g.Count() })
                .ToDictionaryAsync(g => g.rating, g => g.count);

            var ratingDistribution = Enumerable.Range(1, 5)
                .Select(r => new { rating = r, count = ratingCounts.GetValueOrDefault(r, 0) })
                .ToList();

            var byRole = await _context.Reviews
                .AsNoTracking()
                .GroupBy(r => r.UserRole)
                .Select(g => new { role = g.Key, count = g.Count() })
                .ToListAsync();

            var result = new { ratingDistribution, byRole, total };
            _cache.Set("DashboardReviewStats", result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/cities")]
        public async Task<IActionResult> GetCityStats()
        {
            if (_cache.TryGetValue("DashboardCityStats", out object? cachedCities) && cachedCities != null)
            {
                return Ok(cachedCities);
            }

            var userCities = await _context.Users
                .AsNoTracking()
                .Where(u => u.IsActive && !string.IsNullOrEmpty(u.ClientCity))
                .GroupBy(u => u.ClientCity)
                .Select(g => new { city = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(10)
                .ToListAsync();

            var lawyerCities = await _context.LawyerProfiles
                .AsNoTracking()
                .Where(lp => !string.IsNullOrEmpty(lp.City))
                .GroupBy(lp => lp.City)
                .Select(g => new { city = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(10)
                .ToListAsync();

            var result = new { userCities, lawyerCities };
            _cache.Set("DashboardCityStats", result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/specializations")]
        public async Task<IActionResult> GetSpecializationStats()
        {
            if (_cache.TryGetValue("DashboardSpecializationStats", out object? cachedSpecs) && cachedSpecs != null)
            {
                return Ok(cachedSpecs);
            }

            var profiles = await _context.LawyerProfiles
                .AsNoTracking()
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

            var result = new { specCounts };
            _cache.Set("DashboardSpecializationStats", result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("stats/consent")]
        public async Task<IActionResult> GetConsentStats()
        {
            if (_cache.TryGetValue("DashboardConsentStats", out object? cachedConsent) && cachedConsent != null)
            {
                return Ok(cachedConsent);
            }

            var total = await _context.ConsentPreferences.CountAsync();
            var analyticsOptIn = await _context.ConsentPreferences.CountAsync(c => c.AnalyticsConsent);
            var marketingOptIn = await _context.ConsentPreferences.CountAsync(c => c.MarketingConsent);

            var result = new
            {
                total,
                analyticsOptIn,
                analyticsOptInRate = total > 0 ? Math.Round((double)analyticsOptIn / total * 100, 1) : 0,
                marketingOptIn,
                marketingOptInRate = total > 0 ? Math.Round((double)marketingOptIn / total * 100, 1) : 0
            };

            _cache.Set("DashboardConsentStats", result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }
    }
}