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
    public class ContentReportController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ContentReportController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return claim != null && int.TryParse(claim, out int uid) ? uid : null;
        }

        // ── Auto-severity mapping based on reason category ──
        private static readonly Dictionary<string, ReportSeverity> SeverityMap = new()
        {
            // Critical
            ["PII_LEAK"] = ReportSeverity.Critical,
            ["BRIBERY_ALLEGATION"] = ReportSeverity.Critical,
            ["FAKE_REGISTRATION"] = ReportSeverity.Critical,
            ["FRAUD"] = ReportSeverity.Critical,
            // High
            ["SPAM"] = ReportSeverity.High,
            ["ABUSIVE_LANGUAGE"] = ReportSeverity.High,
            ["FAKE_REVIEW"] = ReportSeverity.High,
            ["CLOSED_PERMANENTLY"] = ReportSeverity.High,
            ["MISCONDUCT"] = ReportSeverity.High,
            ["INCORRECT_TEXT"] = ReportSeverity.High,
            // Medium
            ["WRONG_ADDRESS"] = ReportSeverity.Medium,
            ["WRONG_PHONE"] = ReportSeverity.Medium,
            ["NOT_PRACTICING"] = ReportSeverity.Medium,
            ["OUTDATED_AMENDMENT"] = ReportSeverity.Medium,
            ["WRONG_SPECIALIZATION"] = ReportSeverity.Medium,
            ["WRONG_SECTION_NUMBER"] = ReportSeverity.Medium,
            // Low
            ["IRRELEVANT"] = ReportSeverity.Low,
            ["FACILITIES_CHANGED"] = ReportSeverity.Low,
            ["TYPO"] = ReportSeverity.Low,
        };

        /// <summary>
        /// POST /api/contentreport
        /// Create a content report. Allowed for both authenticated and anonymous users.
        /// Anti-brigading: checks for existing active reports with same (TargetType, TargetId, ReasonCategory)
        /// and increments DuplicateCount instead of creating a new row.
        /// Rate limiting: max 5 reports per IP per hour.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateReportDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.TargetType) || string.IsNullOrWhiteSpace(dto.TargetId))
                return BadRequest(new { message = "TargetType and TargetId are required." });

            if (string.IsNullOrWhiteSpace(dto.ReasonCategory))
                return BadRequest(new { message = "ReasonCategory is required." });

            if (string.IsNullOrWhiteSpace(dto.Description) || dto.Description.Trim().Length < 10)
                return BadRequest(new { message = "Please provide a description with at least 10 characters." });

            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

            try
            {
                // Rate limit: 5 reports per IP per hour
                var oneHourAgo = DateTime.UtcNow.AddHours(-1);
                var recentCount = await _context.ContentReports
                    .CountAsync(r => r.ClientIp == clientIp && r.CreatedAt > oneHourAgo);

                if (recentCount >= 5)
                    return StatusCode(429, new { message = "Rate limit exceeded. You can submit up to 5 reports per hour." });

                // Anti-brigading: check for existing active report with same target + reason
                var existingReport = await _context.ContentReports
                    .FirstOrDefaultAsync(r =>
                        r.TargetType == dto.TargetType &&
                        r.TargetId == dto.TargetId &&
                        r.ReasonCategory == dto.ReasonCategory &&
                        r.Status != ReportStatus.Resolved &&
                        r.Status != ReportStatus.Dismissed);

                if (existingReport != null)
                {
                    // Merge duplicate — increment count and update description if longer
                    existingReport.DuplicateCount += 1;
                    if (dto.Description.Trim().Length > (existingReport.Description?.Length ?? 0))
                    {
                        existingReport.Description = dto.Description.Trim();
                    }
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        success = true,
                        message = "Your report has been merged with an existing investigation. Thank you for confirming this issue.",
                        referenceId = $"LC-REP-{existingReport.CreatedAt:yyyy}-{existingReport.Id:D4}",
                        isDuplicate = true
                    });
                }

                // Auto-assign severity based on reason category
                var severity = SeverityMap.GetValueOrDefault(dto.ReasonCategory, ReportSeverity.Medium);

                // Get user info if authenticated
                var userId = GetUserId();
                string reporterName = dto.ReporterName ?? "Citizen";
                string reporterEmail = dto.ReporterEmail ?? string.Empty;

                if (userId != null)
                {
                    var user = await _context.Users.FindAsync(userId.Value);
                    if (user != null)
                    {
                        reporterName = user.FullName;
                        reporterEmail = user.Email;
                    }
                }

                var report = new ContentReport
                {
                    ReporterUserId = userId,
                    ReporterEmail = reporterEmail,
                    ReporterName = reporterName,
                    TargetType = dto.TargetType.Trim(),
                    TargetId = dto.TargetId.Trim(),
                    TargetTitle = (dto.TargetTitle ?? "Unknown").Trim(),
                    ReasonCategory = dto.ReasonCategory.Trim(),
                    Description = dto.Description.Trim(),
                    EvidenceUrl = dto.EvidenceUrl?.Trim(),
                    Severity = severity,
                    Status = ReportStatus.Pending,
                    ClientIp = clientIp,
                    ClientFingerprint = dto.ClientFingerprint?.Trim(),
                    CreatedAt = DateTime.UtcNow
                };

                _context.ContentReports.Add(report);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Report submitted successfully. Our team will review it promptly.",
                    referenceId = $"LC-REP-{report.CreatedAt:yyyy}-{report.Id:D4}",
                    severity = severity.ToString(),
                    estimatedReviewTime = severity switch
                    {
                        ReportSeverity.Critical => "Within 2 hours",
                        ReportSeverity.High => "Within 24 hours",
                        ReportSeverity.Medium => "Within 3 business days",
                        _ => "Within 7 business days"
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CreateReport error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to submit report." });
            }
        }

        /// <summary>
        /// GET /api/contentreport/my
        /// Returns reports submitted by the authenticated user with status tracking.
        /// </summary>
        [HttpGet("my")]
        [Authorize]
        public async Task<IActionResult> GetMyReports([FromQuery] int page = 1, [FromQuery] int limit = 20)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var query = _context.ContentReports.Where(r => r.ReporterUserId == userId.Value);
            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(r => new
                {
                    r.Id,
                    referenceId = $"LC-REP-{r.CreatedAt:yyyy}-{r.Id:D4}",
                    r.TargetType,
                    r.TargetId,
                    r.TargetTitle,
                    r.ReasonCategory,
                    r.Description,
                    severity = r.Severity.ToString(),
                    status = r.Status.ToString(),
                    r.AdminResolutionNotes,
                    r.ResolvedAt,
                    r.CreatedAt
                })
                .ToListAsync();

            return Ok(new { data = items, total, page, limit });
        }
    }

    // ── DTOs ──

    public class CreateReportDto
    {
        public string TargetType { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string? TargetTitle { get; set; }
        public string ReasonCategory { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? EvidenceUrl { get; set; }
        public string? ReporterName { get; set; }
        public string? ReporterEmail { get; set; }
        public string? ClientFingerprint { get; set; }
    }
}