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
    public class ConsentController : ControllerBase
    {
        private readonly AppDbContext _context;

        /// <summary>
        /// The current privacy policy version. Bump this when the policy changes
        /// to force re-consent from all users.
        /// </summary>
        private const string CurrentPolicyVersion = "1.0";

        public ConsentController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> SaveConsent([FromBody] SaveConsentDto request)
        {
            if (string.IsNullOrWhiteSpace(request.AnonymousId))
            {
                return BadRequest("AnonymousId is required.");
            }

            int? userId = null;
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedId))
            {
                userId = parsedId;
            }

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var userAgent = Request.Headers["User-Agent"].ToString();
            if (userAgent.Length > 500) userAgent = userAgent.Substring(0, 500);

            var existing = await _context.ConsentPreferences
                .FirstOrDefaultAsync(c => (userId.HasValue && c.UserId == userId) || c.AnonymousId == request.AnonymousId);

            var now = DateTime.UtcNow;

            if (existing == null)
            {
                existing = new ConsentPreference
                {
                    UserId = userId,
                    AnonymousId = request.AnonymousId,
                    EssentialConsent = true,
                    AnalyticsConsent = request.AnalyticsConsent,
                    MarketingConsent = request.MarketingConsent,
                    ConsentedAt = now,
                    UpdatedAt = now,
                    AnalyticsConsentedAt = request.AnalyticsConsent ? now : null,
                    MarketingConsentedAt = request.MarketingConsent ? now : null,
                    PolicyVersion = CurrentPolicyVersion,
                    IpAddress = ip,
                    UserAgent = userAgent
                };
                _context.ConsentPreferences.Add(existing);
            }
            else
            {
                // Track per-category timestamps only when the value changes
                if (existing.AnalyticsConsent != request.AnalyticsConsent)
                {
                    existing.AnalyticsConsentedAt = now;
                }
                else if (request.AnalyticsConsent && existing.AnalyticsConsentedAt == null)
                {
                    // Fallback in case analytics is active but had no stored timestamp
                    existing.AnalyticsConsentedAt = now;
                }

                if (existing.MarketingConsent != request.MarketingConsent)
                {
                    existing.MarketingConsentedAt = now;
                }
                else if (request.MarketingConsent && existing.MarketingConsentedAt == null)
                {
                    // Fallback in case marketing is active but had no stored timestamp
                    existing.MarketingConsentedAt = now;
                }

                if (userId.HasValue) existing.UserId = userId;
                existing.AnalyticsConsent = request.AnalyticsConsent;
                existing.MarketingConsent = request.MarketingConsent;
                existing.UpdatedAt = now;
                existing.PolicyVersion = CurrentPolicyVersion;
                existing.IpAddress = ip;
                existing.UserAgent = userAgent;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Consent preferences saved successfully.",
                analyticsConsent = existing.AnalyticsConsent,
                marketingConsent = existing.MarketingConsent,
                updatedAt = SpecifyUtc(existing.UpdatedAt),
                analyticsConsentedAt = SpecifyUtc(existing.AnalyticsConsentedAt),
                marketingConsentedAt = SpecifyUtc(existing.MarketingConsentedAt),
                policyVersion = existing.PolicyVersion
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetConsent([FromQuery] string? anonymousId)
        {
            int? userId = null;
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedId))
            {
                userId = parsedId;
            }

            var existing = await _context.ConsentPreferences
                .FirstOrDefaultAsync(c => (userId.HasValue && c.UserId == userId) || (!string.IsNullOrEmpty(anonymousId) && c.AnonymousId == anonymousId));

            if (existing == null)
            {
                return Ok(new
                {
                    hasConsented = false,
                    essentialConsent = true,
                    analyticsConsent = false,
                    marketingConsent = false,
                    policyVersion = CurrentPolicyVersion,
                    currentPolicyVersion = CurrentPolicyVersion
                });
            }

            // If the user consented under an older policy version, flag it
            var needsReConsent = existing.PolicyVersion != CurrentPolicyVersion;

            return Ok(new
            {
                hasConsented = !needsReConsent,
                essentialConsent = true,
                analyticsConsent = existing.AnalyticsConsent,
                marketingConsent = existing.MarketingConsent,
                updatedAt = SpecifyUtc(existing.UpdatedAt),
                consentedAt = SpecifyUtc(existing.ConsentedAt),
                analyticsConsentedAt = SpecifyUtc(existing.AnalyticsConsentedAt),
                marketingConsentedAt = SpecifyUtc(existing.MarketingConsentedAt),
                policyVersion = existing.PolicyVersion,
                currentPolicyVersion = CurrentPolicyVersion,
                needsReConsent
            });
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteConsent([FromQuery] string? anonymousId)
        {
            int? userId = null;
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedId))
            {
                userId = parsedId;
            }

            var existing = await _context.ConsentPreferences
                .Where(c => (userId.HasValue && c.UserId == userId) || (!string.IsNullOrEmpty(anonymousId) && c.AnonymousId == anonymousId))
                .ToListAsync();

            if (existing.Any())
            {
                _context.ConsentPreferences.RemoveRange(existing);
                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true, message = "Consent withdrawn successfully." });
        }

        /// <summary>
        /// Explicitly specifies DateTimeKind.Utc on database values so they serialize with the 'Z' (Zulu) timezone suffix.
        /// This ensures the browser parses them correctly as UTC instead of local timezone fallback.
        /// </summary>
        private static DateTime SpecifyUtc(DateTime dt)
        {
            return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        }

        private static DateTime? SpecifyUtc(DateTime? dt)
        {
            return dt.HasValue ? DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc) : null;
        }
    }

    public class SaveConsentDto
    {
        public string AnonymousId { get; set; } = string.Empty;
        public bool AnalyticsConsent { get; set; }
        public bool MarketingConsent { get; set; }
    }
}