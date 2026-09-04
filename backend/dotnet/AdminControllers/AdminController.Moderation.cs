using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.DTOs.Admin;
using CoreApi.Models;
using CoreApi.Models.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    /// <summary>
    /// Admin Moderation partial class — extends the main AdminController with
    /// report queue management, status updates, bulk actions, and moderation analytics.
    /// </summary>
    public partial class AdminController
    {
        // ═══════════════════════════════════════════════════════════════
        //  MODERATION DESK — Content Reports Management & Analytics
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET /api/admin/moderation/queue OR GET /api/admin/reports
        /// Paginated queue with multi-axis filtering and sorting.
        /// </summary>
        [HttpGet("moderation/queue")]
        [HttpGet("reports")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetModerationQueue(
            [FromQuery] string? status,
            [FromQuery] string? severity,
            [FromQuery] string? targetType,
            [FromQuery] string? search,
            [FromQuery] string? startDate,
            [FromQuery] string? endDate,
            [FromQuery] string? sortBy,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] int limit = 20)
        {
            var effectiveLimit = pageSize > 0 ? pageSize : limit;
            if (effectiveLimit <= 0) effectiveLimit = 20;

            var query = _context.ContentReports.AsNoTracking().AsQueryable();

            // Filters
            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReportStatus>(status, true, out var statusEnum))
            {
                query = query.Where(r => r.Status == statusEnum);
            }

            if (!string.IsNullOrWhiteSpace(severity) && Enum.TryParse<ReportSeverity>(severity, true, out var sevEnum))
            {
                query = query.Where(r => r.Severity == sevEnum);
            }

            if (!string.IsNullOrWhiteSpace(targetType))
            {
                query = query.Where(r => r.TargetType == targetType);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(r =>
                    r.TargetTitle.Contains(s) ||
                    r.Description.Contains(s) ||
                    r.ReporterName.Contains(s) ||
                    r.ReporterEmail.Contains(s) ||
                    r.ReasonCategory.Contains(s));
            }

            if (DateTime.TryParse(startDate, out var start))
                query = query.Where(r => r.CreatedAt >= start);
            if (DateTime.TryParse(endDate, out var end))
                query = query.Where(r => r.CreatedAt <= end.AddDays(1));

            var total = await query.CountAsync();

            // Parse composite sort string like "createdAt_desc" or simple "severity"
            var sortField = (sortBy ?? "createdAt_desc").ToLower();
            bool isAsc = sortField.EndsWith("_asc") || sortField.EndsWith(" asc");

            if (sortField.Contains("severity"))
                query = isAsc ? query.OrderBy(r => r.Severity) : query.OrderByDescending(r => r.Severity);
            else if (sortField.Contains("status"))
                query = isAsc ? query.OrderBy(r => r.Status) : query.OrderByDescending(r => r.Status);
            else if (sortField.Contains("targettype"))
                query = isAsc ? query.OrderBy(r => r.TargetType) : query.OrderByDescending(r => r.TargetType);
            else if (sortField.Contains("duplicatecount"))
                query = isAsc ? query.OrderBy(r => r.DuplicateCount) : query.OrderByDescending(r => r.DuplicateCount);
            else if (sortField.Contains("reportref"))
                query = isAsc ? query.OrderBy(r => r.Id) : query.OrderByDescending(r => r.Id);
            else
                query = isAsc ? query.OrderBy(r => r.CreatedAt) : query.OrderByDescending(r => r.CreatedAt);

            var items = await query
                .Skip((page - 1) * effectiveLimit)
                .Take(effectiveLimit)
                .Select(r => new
                {
                    r.Id,
                    reportRef = $"LC-REP-{r.CreatedAt:yyyy}-{r.Id:D4}",
                    r.ReporterName,
                    r.ReporterEmail,
                    r.ReporterUserId,
                    r.TargetType,
                    r.TargetId,
                    r.TargetTitle,
                    r.ReasonCategory,
                    r.Description,
                    r.EvidenceUrl,
                    severity = r.Severity.ToString(),
                    status = r.Status.ToString(),
                    r.DuplicateCount,
                    moderatorNotes = r.AdminResolutionNotes,
                    resolutionAction = r.AdminResolutionNotes,
                    resolvedByAdminEmail = r.ResolvedByAdminEmail,
                    r.ResolvedAt,
                    reporterIp = r.ClientIp,
                    r.CreatedAt
                })
                .ToListAsync();

            var totalPages = (int)Math.Ceiling(total / (double)effectiveLimit);

            return Ok(new
            {
                success = true,
                data = items,
                pagination = new
                {
                    page,
                    pageSize = effectiveLimit,
                    totalItems = total,
                    totalPages
                }
            });
        }

        /// <summary>
        /// GET /api/admin/moderation/stats OR GET /api/admin/reports/stats
        /// Telemetry and KPI summary metrics for the moderation desk.
        /// </summary>
        [HttpGet("moderation/stats")]
        [HttpGet("reports/stats")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetModerationStats()
        {
            var reports = _context.ContentReports.AsNoTracking();
            var today = DateTime.UtcNow.Date;

            var pendingCount = await reports.CountAsync(r => r.Status == ReportStatus.Pending);
            var underReviewCount = await reports.CountAsync(r => r.Status == ReportStatus.Investigating);
            var criticalPendingCount = await reports.CountAsync(r =>
                r.Severity == ReportSeverity.Critical &&
                (r.Status == ReportStatus.Pending || r.Status == ReportStatus.Investigating));
            var resolvedTodayCount = await reports.CountAsync(r =>
                (r.Status == ReportStatus.Resolved || r.Status == ReportStatus.Dismissed) &&
                r.ResolvedAt >= today);

            // Avg resolution time in minutes
            var resolvedWithDuration = await reports
                .Where(r => r.Status == ReportStatus.Resolved && r.ResolvedAt != null)
                .OrderByDescending(r => r.ResolvedAt)
                .Select(r => new { r.CreatedAt, r.ResolvedAt })
                .Take(200)
                .ToListAsync();

            var avgMinutes = resolvedWithDuration.Any()
                ? (int)resolvedWithDuration.Average(r => (r.ResolvedAt!.Value - r.CreatedAt).TotalMinutes)
                : 12;

            // Reports by Target Type breakdown
            var byType = await reports
                .GroupBy(r => r.TargetType)
                .Select(g => new { Type = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Type, g => g.Count);

            // Reports by Reason Category breakdown
            var byReason = await reports
                .GroupBy(r => r.ReasonCategory)
                .Select(g => new { Reason = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Reason, g => g.Count);

            return Ok(new
            {
                success = true,
                data = new
                {
                    pendingCount,
                    underReviewCount,
                    resolvedTodayCount,
                    criticalPendingCount,
                    averageResolutionMinutes = avgMinutes,
                    reportsByType = byType,
                    reportsByReason = byReason
                }
            });
        }

        /// <summary>
        /// POST /api/admin/moderation/resolve
        /// Resolve single report with specific action and notes.
        /// </summary>
        [HttpPost("moderation/resolve")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ResolveReport([FromBody] ResolveReportRequestDto dto)
        {
            var report = await _context.ContentReports.FindAsync(dto.ReportId);
            if (report == null) return NotFound(new { message = "Report not found." });

            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@legalconnect.in";

            report.Status = ReportStatus.Resolved;
            report.AdminResolutionNotes = string.IsNullOrWhiteSpace(dto.Notes)
                ? $"Action: {dto.Action}"
                : $"Action: {dto.Action} | Notes: {dto.Notes.Trim()}";
            report.ResolvedByAdminEmail = adminEmail;
            report.ResolvedAt = DateTime.UtcNow;

            // Log security audit trail
            _context.SecurityAuditLogs.Add(new SecurityAuditLog
            {
                UserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out int uid) ? uid : null,
                EventType = "REPORT_RESOLVED",
                Description = $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) resolved with action '{dto.Action}'. Notes: {dto.Notes ?? "N/A"}",
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Severity = "Info",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Report marked as resolved." });
        }

        /// <summary>
        /// POST /api/admin/moderation/dismiss
        /// Dismiss single report as false alarm / duplicate.
        /// </summary>
        [HttpPost("moderation/dismiss")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DismissReport([FromBody] DismissReportRequestDto dto)
        {
            var report = await _context.ContentReports.FindAsync(dto.ReportId);
            if (report == null) return NotFound(new { message = "Report not found." });

            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@legalconnect.in";

            report.Status = ReportStatus.Dismissed;
            report.AdminResolutionNotes = dto.Notes?.Trim() ?? "Dismissed as false alarm or duplicate.";
            report.ResolvedByAdminEmail = adminEmail;
            report.ResolvedAt = DateTime.UtcNow;

            _context.SecurityAuditLogs.Add(new SecurityAuditLog
            {
                UserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out int uid) ? uid : null,
                EventType = "REPORT_DISMISSED",
                Description = $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) dismissed. Notes: {dto.Notes ?? "N/A"}",
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Severity = "Info",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Report dismissed." });
        }

        /// <summary>
        /// POST /api/admin/moderation/bulk-resolve
        /// </summary>
        [HttpPost("moderation/bulk-resolve")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> BulkResolveReports([FromBody] BulkResolveRequestDto dto)
        {
            if (dto.ReportIds == null || dto.ReportIds.Count == 0)
                return BadRequest(new { message = "No report IDs provided." });

            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@legalconnect.in";
            var reports = await _context.ContentReports
                .Where(r => dto.ReportIds.Contains(r.Id))
                .ToListAsync();

            foreach (var report in reports)
            {
                report.Status = ReportStatus.Resolved;
                report.AdminResolutionNotes = string.IsNullOrWhiteSpace(dto.Notes)
                    ? $"Bulk Action: {dto.Action}"
                    : $"Bulk Action: {dto.Action} | Notes: {dto.Notes.Trim()}";
                report.ResolvedByAdminEmail = adminEmail;
                report.ResolvedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, count = reports.Count, message = $"{reports.Count} reports resolved." });
        }

        /// <summary>
        /// POST /api/admin/moderation/bulk-dismiss
        /// </summary>
        [HttpPost("moderation/bulk-dismiss")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> BulkDismissReports([FromBody] BulkDismissRequestDto dto)
        {
            if (dto.ReportIds == null || dto.ReportIds.Count == 0)
                return BadRequest(new { message = "No report IDs provided." });

            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@legalconnect.in";
            var reports = await _context.ContentReports
                .Where(r => dto.ReportIds.Contains(r.Id))
                .ToListAsync();

            foreach (var report in reports)
            {
                report.Status = ReportStatus.Dismissed;
                report.AdminResolutionNotes = dto.Notes?.Trim() ?? "Bulk dismissed by administrator.";
                report.ResolvedByAdminEmail = adminEmail;
                report.ResolvedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, count = reports.Count, message = $"{reports.Count} reports dismissed." });
        }

        /// <summary>
        /// GET /api/admin/moderation/audit-trail/{reportId}
        /// </summary>
        [HttpGet("moderation/audit-trail/{reportId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetModerationAuditTrail(long reportId)
        {
            var logs = await _context.SecurityAuditLogs
                .AsNoTracking()
                .Where(l => l.Description.Contains($"Report #{reportId}"))
                .OrderByDescending(l => l.CreatedAt)
                .Take(20)
                .ToListAsync();

            return Ok(new { success = true, data = logs });
        }
    }
}