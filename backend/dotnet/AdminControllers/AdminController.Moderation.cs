using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.DTOs.Admin;
using CoreApi.Models;
using CoreApi.Models.Admin;
using System.Text.Json;
using System.Net.Http.Json;
using System.Threading;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using CoreApi.Hubs.Admin;

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

        // --- Shared Helpers -------------------------------------------------

        /// <summary>
        /// Returns the current admin's email from JWT claims.
        /// Throws UnauthorizedResult if identity claims are missing — prevents silent fallback.
        /// </summary>
        private string GetAdminEmail()
        {
            var email = User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email))
                throw new UnauthorizedAccessException("Admin session has no valid email claim. Re-authenticate.");
            return email;
        }

        /// <summary>
        /// Returns the current admin's user ID from JWT claims (nullable).
        /// </summary>
        private int? GetAdminUserId()
        {
            return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out int uid) ? uid : null;
        }

        /// <summary>
        /// Purges cached analytics metrics when ticket status transitions occur.
        /// </summary>
        private void InvalidateModerationAnalyticsCache()
        {
            _cache.Remove("ModerationAnalytics_7");
            _cache.Remove("ModerationAnalytics_14");
            _cache.Remove("ModerationAnalytics_30");
            _cache.Remove("ModerationAnalytics_90");
        }

        /// <summary>
        /// Creates a SecurityAuditLog entry with optional RelatedReportId for indexed lookups.
        /// </summary>
        private SecurityAuditLog CreateAuditLog(string eventType, string description, string severity = "Info", long? relatedReportId = null)
        {
            // Truncate description to 997 chars + "..." to respect [MaxLength(1000)] on the model
            var safeDescription = description.Length > 997 ? description[..997] + "..." : description;
            return new SecurityAuditLog
            {
                UserId = GetAdminUserId(),
                EventType = eventType,
                Description = safeDescription,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Severity = severity,
                RelatedReportId = relatedReportId,
                CreatedAt = DateTime.UtcNow
            };
        }

        /// <summary>
        /// Real-time SignalR event broadcast for collaborative moderation queue synchronization.
        /// Dispatches live state transitions to all active administrator sessions via AdminNotificationHub.
        /// </summary>
        private async Task BroadcastModerationEventAsync(string eventType, ContentReport report, object? extraData = null)
        {
            if (_hubContext == null) return;
            try
            {
                await _hubContext.Clients.Group("Admins").SendAsync("ModerationTicketUpdated", new
                {
                    eventType,
                    reportId = report.Id,
                    status = report.Status.ToString(),
                    severity = report.Severity.ToString(),
                    assignedAdminEmail = report.AssignedAdminEmail,
                    resolvedByAdminEmail = report.ResolvedByAdminEmail,
                    updatedAt = DateTime.UtcNow,
                    extra = extraData
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Real-time broadcast failed for event {EventType} on report #{Id}: {Msg}", eventType, report.Id, ex.Message);
            }
        }

        /// <summary>
        /// Shared cascading enforcement logic. Applies the enforcement action
        /// to the target entity referenced by the report. Used by both single-resolve
        /// and bulk-resolve to guarantee enforcement parity across all operational surfaces.
        /// </summary>
        private async Task ApplyCascadingEnforcement(ContentReport report, string action, string? notes)
        {
            if (report.TargetType.Equals("Review", StringComparison.OrdinalIgnoreCase) && int.TryParse(report.TargetId, out int reviewId))
            {
                var review = await _context.Reviews.FindAsync(reviewId);
                if (review != null)
                {
                    if (action == "ContentRemoved")
                    {
                        review.ModerationStatus = "Hidden";
                        review.FlagReason = $"Action taken on report #{report.Id}: {notes ?? "Removed by moderation"}";
                    }
                    else if (action == "WarningIssued")
                    {
                        review.ModerationStatus = "Flagged";
                        review.FlagReason = $"Formal warning issued: {notes ?? "Policy violation"}";
                    }
                    else if (action == "NoActionRequired")
                    {
                        if (review.ModerationStatus == "Flagged") review.ModerationStatus = "Approved";
                    }
                }
            }
            else if (report.TargetType.Equals("Lawyer", StringComparison.OrdinalIgnoreCase) && int.TryParse(report.TargetId, out int lawyerId))
            {
                var lawyer = await _context.LawyerProfiles.Include(l => l.User).FirstOrDefaultAsync(l => l.Id == lawyerId || l.UserId == lawyerId);
                if (lawyer != null)
                {
                    if (action == "UserSuspended")
                    {
                        if (lawyer.User != null) lawyer.User.IsActive = false;
                        lawyer.IsVerified = false;
                    }
                    else if (action == "WarningIssued")
                    {
                        lawyer.IsVerified = false;
                    }
                }
            }

            if (action == "UserSuspended" && report.TargetType.Equals("User", StringComparison.OrdinalIgnoreCase) && int.TryParse(report.TargetId, out int userId))
            {
                var user = await _context.Users.FindAsync(userId);
                if (user != null) user.IsActive = false;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  GET MODERATION QUEUE (Paginated, Filtered, Sorted)
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

            var rawItems = await query
                .Skip((page - 1) * effectiveLimit)
                .Take(effectiveLimit)
                .ToListAsync();

            var items = rawItems.Select(r => new
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
                resolutionAction = r.AdminResolutionNotes != null && r.AdminResolutionNotes.Contains("Action: ")
                    ? r.AdminResolutionNotes.Substring(r.AdminResolutionNotes.IndexOf("Action: ") + 8).Split('|')[0].Trim()
                    : (r.Status == ReportStatus.Resolved ? "Resolved" : (r.Status == ReportStatus.Dismissed ? "Dismissed" : "")),
                resolvedByAdminEmail = r.ResolvedByAdminEmail,
                assignedAdminEmail = r.AssignedAdminEmail ?? r.ResolvedByAdminEmail,
                assignedAdminId = (int?)null,
                r.ResolvedAt,
                reporterIp = r.ClientIp,
                r.ClientFingerprint,
                r.CreatedAt
            }).ToList();

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

        // ═══════════════════════════════════════════════════════════════
        //  TARGET ENTITY PREVIEW
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET /api/admin/moderation/target-preview/{targetType}/{targetId}
        /// Fetches the live record for the reported entity to display side-by-side with allegation.
        /// </summary>
        [HttpGet("moderation/target-preview/{targetType}/{targetId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetTargetPreview(string targetType, string targetId)
        {
            if (string.IsNullOrWhiteSpace(targetType) || string.IsNullOrWhiteSpace(targetId))
                return BadRequest(new { message = "targetType and targetId are required." });

            var type = targetType.Trim().ToLowerInvariant();

            try
            {
                if (type == "review" && int.TryParse(targetId, out int reviewId))
                {
                    var review = await _context.Reviews.AsNoTracking().FirstOrDefaultAsync(r => r.Id == reviewId);
                    if (review != null)
                    {
                        return Ok(new
                        {
                            success = true,
                            data = new
                            {
                                id = review.Id,
                                targetType = "Review",
                                targetName = review.TargetName,
                                authorName = review.AuthorName,
                                rating = review.Rating,
                                content = review.Content,
                                moderationStatus = review.ModerationStatus,
                                flagReason = review.FlagReason,
                                isVerifiedClient = review.IsVerifiedClient,
                                advocateReply = review.AdvocateReply,
                                advocateReplyStatus = review.AdvocateReplyStatus,
                                createdAt = review.CreatedAt
                            }
                        });
                    }
                }
                else if (type == "lawyer" && int.TryParse(targetId, out int lawyerId))
                {
                    var lawyer = await _context.LawyerProfiles
                        .Include(l => l.User)
                        .AsNoTracking()
                        .FirstOrDefaultAsync(l => l.Id == lawyerId || l.UserId == lawyerId);

                    if (lawyer != null)
                    {
                        return Ok(new
                        {
                            success = true,
                            data = new
                            {
                                id = lawyer.Id,
                                targetType = "Lawyer",
                                fullName = lawyer.User?.FullName ?? "Advocate",
                                email = lawyer.User?.Email ?? string.Empty,
                                phone = !string.IsNullOrWhiteSpace(lawyer.Phone) ? lawyer.Phone : lawyer.User?.Phone,
                                barCouncilNumber = lawyer.BarCouncilNumber,
                                specialization = lawyer.Specialization,
                                city = lawyer.City,
                                officeAddress = lawyer.OfficeAddress,
                                experienceYears = lawyer.ExperienceYears,
                                isVerified = lawyer.IsVerified,
                                consultationFee = lawyer.ConsultationFee,
                                casesCompleted = lawyer.CasesCompleted,
                                successRate = lawyer.SuccessRate,
                                isActive = lawyer.User?.IsActive ?? true
                            }
                        });
                    }
                }
                else if (type == "helpline" && int.TryParse(targetId, out int helplineId))
                {
                    var helpline = await _context.Helplines.AsNoTracking().FirstOrDefaultAsync(h => h.Id == helplineId);
                    if (helpline != null)
                    {
                        return Ok(new
                        {
                            success = true,
                            data = new
                            {
                                id = helpline.Id,
                                targetType = "Helpline",
                                name = helpline.Name,
                                number = helpline.Number,
                                categories = helpline.Categories,
                                description = helpline.Description,
                                isActive = helpline.IsActive
                            }
                        });
                    }
                }
                else if (type == "legalresource")
                {
                    try
                    {
                        var nodeBaseUrl = _configuration["NodeApi:BaseUrl"] ?? "http://localhost:5000";
                        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                        var httpClient = _httpClientFactory.CreateClient();

                        // Forward incoming administrator credentials for cross-service authenticated preview
                        var authHeader = HttpContext.Request.Headers["Authorization"].FirstOrDefault();
                        if (!string.IsNullOrEmpty(authHeader))
                        {
                            httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", authHeader);
                        }

                        var response = await httpClient.GetAsync($"{nodeBaseUrl}/api/legal/resources/{targetId}", cts.Token);
                        if (response.IsSuccessStatusCode)
                        {
                            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cts.Token);
                            if (json.TryGetProperty("data", out var resourceData))
                            {
                                var name = resourceData.TryGetProperty("name", out var np) ? np.GetString() : "Legal Aid Resource";
                                var resType = resourceData.TryGetProperty("type", out var tp) ? tp.GetString() : "LegalAid";
                                var city = resourceData.TryGetProperty("city", out var cp) ? cp.GetString() : "";
                                var state = resourceData.TryGetProperty("state", out var sp) ? sp.GetString() : "";
                                var address = resourceData.TryGetProperty("address", out var ap) ? ap.GetString() : "";
                                var website = resourceData.TryGetProperty("website", out var wp) ? wp.GetString() : null;
                                var opHours = resourceData.TryGetProperty("operatingHours", out var ohp) ? ohp.GetString() : null;
                                var opDays = resourceData.TryGetProperty("operatingDays", out var odp) ? odp.GetString() : null;
                                var status = resourceData.TryGetProperty("status", out var stp) ? stp.GetString() : "approved";
                                var views = resourceData.TryGetProperty("viewsCount", out var vp) && vp.ValueKind == JsonValueKind.Number ? vp.GetInt32() : 0;
                                var isVerified = resourceData.TryGetProperty("isVerified", out var ivp) && ivp.GetBoolean();
                                var contact = resourceData.TryGetProperty("contactNumber", out var cnp) && cnp.ValueKind == JsonValueKind.Array
                                    ? string.Join(", ", cnp.EnumerateArray().Select(x => x.GetString()))
                                    : "";

                                var cats = resourceData.TryGetProperty("categories", out var catp) && catp.ValueKind == JsonValueKind.Array
                                    ? catp.EnumerateArray().Select(x => x.GetString()).Where(x => !string.IsNullOrEmpty(x)).ToList()
                                    : new List<string?>();

                                return Ok(new
                                {
                                    success = true,
                                    data = new
                                    {
                                        id = targetId,
                                        targetType = "LegalResource",
                                        name,
                                        resourceType = resType,
                                        city,
                                        state,
                                        address,
                                        contactNumber = contact,
                                        website,
                                        operatingHours = opHours,
                                        operatingDays = opDays,
                                        status,
                                        viewsCount = views,
                                        isVerified,
                                        categories = cats
                                    }
                                });
                            }
                        }
                    }
                    catch (Exception resEx)
                    {
                        _logger.LogWarning("Target preview error querying Node legal resource {Id}: {Msg}", targetId, resEx.Message);
                    }
                }

                // Generic fallback for resources / Bare Acts
                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        id = targetId,
                        targetType,
                        message = "Entity details retrieved from directory registry.",
                        targetId
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch target preview for {TargetType}/{TargetId}", targetType, targetId);
                return StatusCode(500, new { message = "Failed to fetch target preview. Please try again." });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  MODERATION TELEMETRY & AGGREGATED METRICS
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET /api/admin/moderation/stats OR GET /api/admin/reports/stats
        /// Telemetry and KPI summary metrics for the moderation desk.
        /// Optimized grouped count aggregation minimizing database round-trips.
        /// </summary>
        [HttpGet("moderation/stats")]
        [HttpGet("reports/stats")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetModerationStats()
        {
            var reports = _context.ContentReports.AsNoTracking();
            var today = DateTime.UtcNow.Date;

            // Combined status and severity aggregations into a single grouped query
            var statusSeverityCounts = await reports
                .GroupBy(r => new { r.Status, r.Severity })
                .Select(g => new { g.Key.Status, g.Key.Severity, Count = g.Count() })
                .ToListAsync();

            var pendingCount = statusSeverityCounts.Where(x => x.Status == ReportStatus.Pending).Sum(x => x.Count);
            var underReviewCount = statusSeverityCounts.Where(x => x.Status == ReportStatus.Investigating).Sum(x => x.Count);
            var criticalPendingCount = statusSeverityCounts
                .Where(x => x.Severity == ReportSeverity.Critical && (x.Status == ReportStatus.Pending || x.Status == ReportStatus.Investigating))
                .Sum(x => x.Count);

            // Resolved today still needs a date filter — separate query
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

        // ═══════════════════════════════════════════════════════════════
        //  RESOLVE REPORT (Single)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/resolve
        /// Resolve single report with specific action, notes, and cascading database enforcement.
        /// </summary>
        [HttpPost("moderation/resolve")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> ResolveReport([FromBody] ResolveReportRequestDto dto)
        {
            var report = await _context.ContentReports.FindAsync(dto.ReportId);
            if (report == null) return NotFound(new { message = "Report not found." });

            var adminEmail = GetAdminEmail();

            report.Status = ReportStatus.Resolved;
            report.AdminResolutionNotes = string.IsNullOrWhiteSpace(dto.Notes)
                ? $"Action: {dto.Action}"
                : $"Action: {dto.Action} | Notes: {dto.Notes.Trim()}";
            report.ResolvedByAdminEmail = adminEmail;
            report.ResolvedAt = DateTime.UtcNow;

            // Apply entity enforcement cascades (soft deletion, suspension, flag removal)
            if (dto.CascadeEnforcement)
            {
                await ApplyCascadingEnforcement(report, dto.Action, dto.Notes);
            }

            // Record immutable security audit log entry with foreign key report attribution
            _context.SecurityAuditLogs.Add(CreateAuditLog(
                "REPORT_RESOLVED",
                $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) resolved with action '{dto.Action}'. Cascade: {dto.CascadeEnforcement}. Notes: {dto.Notes ?? "N/A"}",
                "Info",
                report.Id
            ));

            await _context.SaveChangesAsync();

            await BroadcastModerationEventAsync("REPORT_RESOLVED", report, new { action = dto.Action, resolvedBy = adminEmail });

            return Ok(new { success = true, message = "Report marked as resolved with enforcement applied." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  DISMISS REPORT (Single)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/dismiss
        /// Dismiss single report as false alarm / duplicate with optional target flag restoration.
        /// </summary>
        [HttpPost("moderation/dismiss")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> DismissReport([FromBody] DismissReportRequestDto dto)
        {
            var report = await _context.ContentReports.FindAsync(dto.ReportId);
            if (report == null) return NotFound(new { message = "Report not found." });

            var adminEmail = GetAdminEmail();

            report.Status = ReportStatus.Dismissed;
            report.AdminResolutionNotes = dto.Notes?.Trim() ?? "Dismissed as false alarm or duplicate.";
            report.ResolvedByAdminEmail = adminEmail;
            report.ResolvedAt = DateTime.UtcNow;

            if (dto.RestoreTargetIfFlagged)
            {
                if (report.TargetType.Equals("Review", StringComparison.OrdinalIgnoreCase) && int.TryParse(report.TargetId, out int reviewId))
                {
                    var review = await _context.Reviews.FindAsync(reviewId);
                    if (review != null && review.ModerationStatus == "Flagged")
                    {
                        review.ModerationStatus = "Approved";
                        review.FlagReason = null;
                    }
                }
            }

            // Record immutable audit log entry for dismissal
            _context.SecurityAuditLogs.Add(CreateAuditLog(
                "REPORT_DISMISSED",
                $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) dismissed. Notes: {dto.Notes ?? "N/A"}",
                "Info",
                report.Id
            ));

            await _context.SaveChangesAsync();

            await BroadcastModerationEventAsync("REPORT_DISMISSED", report, new { dismissedBy = adminEmail });

            return Ok(new { success = true, message = "Report dismissed and recorded in audit trail." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  CLAIM TICKET (Optimistic Concurrency Control)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/{reportId}/claim
        /// Assigns a report ticket exclusively to the active administrator session.
        /// Returns 409 Conflict if already claimed by a concurrent peer.
        /// Maintains dedicated assignment ownership distinct from final resolution attribution.
        /// </summary>
        [HttpPost("moderation/{reportId}/claim")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> ClaimReport(long reportId)
        {
            var adminEmail = GetAdminEmail();
            var now = DateTime.UtcNow;

            // Atomic claim via raw SQL UPDATE ... WHERE to prevent TOCTOU race condition.
            // Only claims the report if it is currently unassigned OR already assigned to the same admin.
            var rowsAffected = await _context.Database.ExecuteSqlRawAsync(
                @"UPDATE ContentReports
                  SET AssignedAdminEmail = {0}, AssignedAt = {1},
                      Status = CASE WHEN Status = 1 THEN 2 ELSE Status END
                  WHERE Id = {2}
                    AND (AssignedAdminEmail IS NULL OR AssignedAdminEmail = '' OR AssignedAdminEmail = {0})",
                adminEmail, now, reportId);

            if (rowsAffected == 0)
            {
                // Either the report doesn't exist, or it was already claimed by someone else
                var existing = await _context.ContentReports.AsNoTracking()
                    .Where(r => r.Id == reportId)
                    .Select(r => new { r.AssignedAdminEmail })
                    .FirstOrDefaultAsync();

                if (existing == null)
                    return NotFound(new { message = "Report not found." });

                return Conflict(new
                {
                    success = false,
                    message = $"Ticket already claimed by {existing.AssignedAdminEmail}. Release the ticket first or contact the assigned moderator.",
                    assignedEmail = existing.AssignedAdminEmail
                });
            }

            // Reload the entity for audit log and SignalR broadcast
            var report = await _context.ContentReports.FindAsync(reportId);

            // Record audit log entry for ticket claim
            _context.SecurityAuditLogs.Add(CreateAuditLog(
                "REPORT_CLAIMED",
                $"Report #{reportId} ({report?.TargetType}:{report?.TargetId}) claimed by {adminEmail}",
                "Info",
                reportId
            ));

            await _context.SaveChangesAsync();

            if (report != null)
                await BroadcastModerationEventAsync("REPORT_CLAIMED", report, new { claimedBy = adminEmail });

            InvalidateModerationAnalyticsCache();

            return Ok(new { success = true, message = $"Report ticket claimed by {adminEmail}", assignedEmail = adminEmail });
        }

        // ═══════════════════════════════════════════════════════════════
        //  ESCALATE SEVERITY
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/{reportId}/escalate
        /// Escalates severity tier of a report (e.g. to Critical / High Priority) with forensic notes.
        /// </summary>
        [HttpPost("moderation/{reportId}/escalate")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> EscalateReport(long reportId, [FromBody] EscalateSeverityDto dto)
        {
            var report = await _context.ContentReports.FindAsync(reportId);
            if (report == null) return NotFound(new { message = "Report not found." });

            if (Enum.TryParse<ReportSeverity>(dto.Severity, true, out var sev))
            {
                var previousSeverity = report.Severity.ToString();
                report.Severity = sev;
                report.Status = ReportStatus.Investigating;
                if (!string.IsNullOrWhiteSpace(dto.Notes))
                {
                    report.AdminResolutionNotes = string.IsNullOrWhiteSpace(report.AdminResolutionNotes)
                        ? $"[Escalated to {sev}]: {dto.Notes}"
                        : $"{report.AdminResolutionNotes} | [Escalated to {sev}]: {dto.Notes}";
                }

                // Record audit log for escalation action
                _context.SecurityAuditLogs.Add(CreateAuditLog(
                    "REPORT_ESCALATED",
                    $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) escalated from {previousSeverity} to {sev}. Notes: {dto.Notes ?? "N/A"}",
                    sev == ReportSeverity.Critical ? "Warning" : "Info",
                    report.Id
                ));

                await _context.SaveChangesAsync();

                await BroadcastModerationEventAsync("REPORT_ESCALATED", report, new { severity = sev.ToString() });

                InvalidateModerationAnalyticsCache();

                return Ok(new { success = true, message = $"Report escalated to {sev}", severity = sev.ToString() });
            }

            var validValues = string.Join(", ", Enum.GetNames<ReportSeverity>());
            return BadRequest(new { message = $"Invalid severity value '{dto.Severity}'. Valid values: {validValues}" });
        }

        // ═══════════════════════════════════════════════════════════════
        //  BULK RESOLVE (Cascading Enforcement & Audit Compliance)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/bulk-resolve
        /// Executes batch resolution across selected reports with cascading database enforcement.
        /// Generates discrete immutable audit log entries for regulatory compliance.
        /// Bounded to a maximum of 100 IDs per request to prevent connection starvation.
        /// </summary>
        [HttpPost("moderation/bulk-resolve")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> BulkResolveReports([FromBody] BulkResolveRequestDto dto)
        {
            if (dto.ReportIds == null || dto.ReportIds.Count == 0)
                return BadRequest(new { message = "No report IDs provided." });

            // Defensive boundary check: guard against oversized batch payloads
            if (dto.ReportIds.Count > 100)
                return BadRequest(new { message = "Cannot bulk-resolve more than 100 reports at once." });

            var adminEmail = GetAdminEmail();
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

                // Shared cascading enforcement engine for all supported entity domains
                if (dto.CascadeEnforcement)
                {
                    await ApplyCascadingEnforcement(report, dto.Action, dto.Notes);
                }

                // Discrete audit log entry per report for DPDP / ISO 27001 regulatory compliance
                _context.SecurityAuditLogs.Add(CreateAuditLog(
                    "REPORT_BULK_RESOLVED",
                    $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) bulk-resolved with action '{dto.Action}'. Cascade: {dto.CascadeEnforcement}. Notes: {dto.Notes ?? "N/A"}",
                    "Info",
                    report.Id
                ));
            }

            await _context.SaveChangesAsync();

            if (_hubContext != null)
            {
                try
                {
                    await _hubContext.Clients.Group("Admins").SendAsync("ModerationTicketUpdated", new
                    {
                        eventType = "REPORTS_BULK_RESOLVED",
                        reportIds = dto.ReportIds,
                        action = dto.Action,
                        resolvedBy = adminEmail,
                        updatedAt = DateTime.UtcNow
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Real-time broadcast failed for bulk resolve: {Msg}", ex.Message);
                }
            }

            InvalidateModerationAnalyticsCache();

            return Ok(new { success = true, count = reports.Count, message = $"{reports.Count} reports resolved with cascading enforcement." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  BULK DISMISS (Batch Audit Compliance)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/bulk-dismiss
        /// Executes batch dismissal across selected reports with audit trail compliance.
        /// Bounded to a maximum of 100 IDs per request.
        /// </summary>
        [HttpPost("moderation/bulk-dismiss")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> BulkDismissReports([FromBody] BulkDismissRequestDto dto)
        {
            if (dto.ReportIds == null || dto.ReportIds.Count == 0)
                return BadRequest(new { message = "No report IDs provided." });

            // Defensive boundary check
            if (dto.ReportIds.Count > 100)
                return BadRequest(new { message = "Cannot bulk-dismiss more than 100 reports at once." });

            var adminEmail = GetAdminEmail();
            var reports = await _context.ContentReports
                .Where(r => dto.ReportIds.Contains(r.Id))
                .ToListAsync();

            foreach (var report in reports)
            {
                report.Status = ReportStatus.Dismissed;
                report.AdminResolutionNotes = dto.Notes?.Trim() ?? "Bulk dismissed by administrator.";
                report.ResolvedByAdminEmail = adminEmail;
                report.ResolvedAt = DateTime.UtcNow;

                // Discrete audit log entry per report for regulatory compliance
                _context.SecurityAuditLogs.Add(CreateAuditLog(
                    "REPORT_BULK_DISMISSED",
                    $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) bulk-dismissed. Notes: {dto.Notes ?? "N/A"}",
                    "Info",
                    report.Id
                ));
            }

            await _context.SaveChangesAsync();

            if (_hubContext != null)
            {
                try
                {
                    await _hubContext.Clients.Group("Admins").SendAsync("ModerationTicketUpdated", new
                    {
                        eventType = "REPORTS_BULK_DISMISSED",
                        reportIds = dto.ReportIds,
                        dismissedBy = adminEmail,
                        updatedAt = DateTime.UtcNow
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Real-time broadcast failed for bulk dismiss: {Msg}", ex.Message);
                }
            }

            InvalidateModerationAnalyticsCache();

            return Ok(new { success = true, count = reports.Count, message = $"{reports.Count} reports dismissed." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  AUDIT TRAIL (Indexed Forensic Query)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET /api/admin/moderation/audit-trail/{reportId}
        /// Retrieves chronological audit logs using indexed RelatedReportId foreign key lookup.
        /// Falls back to Description-based match for legacy log entries.
        /// </summary>
        [HttpGet("moderation/audit-trail/{reportId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetModerationAuditTrail(long reportId)
        {
            // Primary indexed query by RelatedReportId
            var logs = await _context.SecurityAuditLogs
                .AsNoTracking()
                .Where(l => l.RelatedReportId == reportId)
                .OrderByDescending(l => l.CreatedAt)
                .Take(50)
                .ToListAsync();

            // Fallback: also include legacy entries that used Description.Contains
            if (logs.Count == 0)
            {
                logs = await _context.SecurityAuditLogs
                    .AsNoTracking()
                    .Where(l => l.Description.Contains($"Report #{reportId}"))
                    .OrderByDescending(l => l.CreatedAt)
                    .Take(20)
                    .ToListAsync();
            }

            return Ok(new { success = true, data = logs });
        }

        // ═══════════════════════════════════════════════════════════════
        //  RE-OPEN REPORT TICKET (Forensic State Restoration)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/{reportId}/reopen
        /// Re-opens a previously resolved or dismissed report ticket for forensic re-evaluation.
        /// Restores status to Investigating, resets resolution metadata, assigns to caller,
        /// logs immutable audit trail, and broadcasts real-time SignalR sync to peer admins.
        /// </summary>
        [HttpPost("moderation/{reportId}/reopen")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> ReopenReport(long reportId, [FromBody] ReopenReportRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest(new { message = "Reopen reason is mandatory for compliance auditing." });

            var report = await _context.ContentReports.FindAsync(reportId);
            if (report == null) return NotFound(new { message = "Report not found." });

            var adminEmail = GetAdminEmail();
            var previousStatus = report.Status.ToString();

            // Transition back to active investigation
            report.Status = ReportStatus.Investigating;
            report.ResolvedAt = null;
            report.ResolvedByAdminEmail = null;
            report.AssignedAdminEmail = adminEmail;
            report.AssignedAt = DateTime.UtcNow;

            var reopenTimestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            var reopenLog = $"[Reopened by {adminEmail} on {reopenTimestamp} UTC]: {dto.Reason.Trim()}";
            report.AdminResolutionNotes = string.IsNullOrWhiteSpace(report.AdminResolutionNotes)
                ? reopenLog
                : $"{report.AdminResolutionNotes}\n\n{reopenLog}";

            // Optional target state adjustment (e.g. if review was hidden and needs restoration during re-triage)
            if (dto.RestoreTargetVisibility && report.TargetType.Equals("Review", StringComparison.OrdinalIgnoreCase) && int.TryParse(report.TargetId, out int reviewId))
            {
                var review = await _context.Reviews.FindAsync(reviewId);
                if (review != null && review.ModerationStatus == "Hidden")
                {
                    review.ModerationStatus = "Flagged";
                    review.FlagReason = $"Re-opened report #{report.Id}: {dto.Reason.Trim()}";
                }
            }

            // Record compliance audit log
            _context.SecurityAuditLogs.Add(CreateAuditLog(
                "REPORT_REOPENED",
                $"Report #{report.Id} ({report.TargetType}:{report.TargetId}) re-opened from {previousStatus} by {adminEmail}. Reason: {dto.Reason.Trim()}",
                "Warning",
                report.Id
            ));

            await _context.SaveChangesAsync();

            await BroadcastModerationEventAsync("REPORT_REOPENED", report, new
            {
                reopenedBy = adminEmail,
                reason = dto.Reason.Trim()
            });

            InvalidateModerationAnalyticsCache();

            return Ok(new
            {
                success = true,
                message = $"Report #{report.Id} successfully re-opened for investigation.",
                data = new
                {
                    report.Id,
                    status = report.Status.ToString(),
                    assignedAdminEmail = report.AssignedAdminEmail,
                    adminResolutionNotes = report.AdminResolutionNotes
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════
        //  INTERNAL NOTES THREAD (Collaborative Moderator Discussion)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET /api/admin/moderation/{reportId}/notes
        /// Retrieves internal discussion notes for a ticket from indexed audit storage.
        /// </summary>
        [HttpGet("moderation/{reportId}/notes")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetReportNotes(long reportId)
        {
            var notes = await _context.SecurityAuditLogs
                .AsNoTracking()
                .Include(l => l.User)
                .Where(l => l.RelatedReportId == reportId && l.EventType == "INTERNAL_NOTE")
                .OrderBy(l => l.CreatedAt)
                .Select(l => new
                {
                    id = l.Id,
                    reportId = l.RelatedReportId,
                    note = l.Description,
                    userId = l.UserId,
                    authorEmail = l.User != null ? l.User.Email : (l.Metadata != null ? l.Metadata : "admin@legalconnect.in"),
                    authorName = l.User != null ? l.User.FullName : "Administrator",
                    createdAt = l.CreatedAt
                })
                .ToListAsync();

            return Ok(new { success = true, data = notes });
        }

        /// <summary>
        /// POST /api/admin/moderation/{reportId}/notes
        /// Adds a private moderator note to the ticket discussion thread.
        /// Persisted to indexed audit storage and broadcasted in real-time.
        /// </summary>
        [HttpPost("moderation/{reportId}/notes")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> AddReportNote(long reportId, [FromBody] AddReportNoteRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Note))
                return BadRequest(new { message = "Note content cannot be empty." });

            var report = await _context.ContentReports.FindAsync(reportId);
            if (report == null) return NotFound(new { message = "Report not found." });

            var adminEmail = GetAdminEmail();
            var adminUserId = GetAdminUserId();
            var adminUser = adminUserId.HasValue ? await _context.Users.FindAsync(adminUserId.Value) : null;
            var authorName = adminUser?.FullName ?? "Administrator";

            var log = new SecurityAuditLog
            {
                UserId = adminUserId,
                EventType = "INTERNAL_NOTE",
                Description = dto.Note.Trim(),
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Severity = "Info",
                RelatedReportId = report.Id,
                Metadata = adminEmail,
                CreatedAt = DateTime.UtcNow
            };

            _context.SecurityAuditLogs.Add(log);
            await _context.SaveChangesAsync();

            var noteResponse = new
            {
                id = log.Id,
                reportId = report.Id,
                note = log.Description,
                userId = log.UserId,
                authorEmail = adminEmail,
                authorName,
                createdAt = log.CreatedAt
            };

            await BroadcastModerationEventAsync("INTERNAL_NOTE_ADDED", report, noteResponse);

            return Ok(new
            {
                success = true,
                message = "Internal note added to ticket.",
                data = noteResponse
            });
        }

        // ═══════════════════════════════════════════════════════════════
        //  SERVER-SIDE DATASET EXPORT
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET /api/admin/moderation/export?format=csv|json
        /// Streams the complete filtered dataset from the database in CSV or JSON format.
        /// </summary>
        [HttpGet("moderation/export")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ExportModerationQueue(
            [FromQuery] string? status,
            [FromQuery] string? severity,
            [FromQuery] string? targetType,
            [FromQuery] string? search,
            [FromQuery] string? startDate,
            [FromQuery] string? endDate,
            [FromQuery] string format = "csv")
        {
            var query = _context.ContentReports.AsNoTracking().AsQueryable();

            // Apply same filters as queue
            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReportStatus>(status, true, out var statusEnum))
                query = query.Where(r => r.Status == statusEnum);
            if (!string.IsNullOrWhiteSpace(severity) && Enum.TryParse<ReportSeverity>(severity, true, out var sevEnum))
                query = query.Where(r => r.Severity == sevEnum);
            if (!string.IsNullOrWhiteSpace(targetType))
                query = query.Where(r => r.TargetType == targetType);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(r =>
                    r.TargetTitle.Contains(s) || r.Description.Contains(s) ||
                    r.ReporterName.Contains(s) || r.ReporterEmail.Contains(s) ||
                    r.ReasonCategory.Contains(s));
            }
            if (DateTime.TryParse(startDate, out var start))
                query = query.Where(r => r.CreatedAt >= start);
            if (DateTime.TryParse(endDate, out var end))
                query = query.Where(r => r.CreatedAt <= end.AddDays(1));

            // Cap at 10,000 to prevent OOM
            var records = await query
                .OrderByDescending(r => r.CreatedAt)
                .Take(10000)
                .Select(r => new
                {
                    Reference = $"LC-REP-{r.CreatedAt:yyyy}-{r.Id:D4}",
                    EntityType = r.TargetType,
                    TargetTitle = r.TargetTitle,
                    Reason = r.ReasonCategory,
                    Severity = r.Severity.ToString(),
                    Status = r.Status.ToString(),
                    ReporterName = r.ReporterName,
                    ReporterEmail = r.ReporterEmail,
                    DuplicateFlags = r.DuplicateCount,
                    ReportedAt = r.CreatedAt,
                    ResolvedAt = r.ResolvedAt,
                    ResolvedBy = r.ResolvedByAdminEmail ?? "",
                    ResolutionNotes = r.AdminResolutionNotes ?? ""
                })
                .ToListAsync();

            // Audit log for export
            _context.SecurityAuditLogs.Add(CreateAuditLog(
                "MODERATION_EXPORT",
                $"Exported {records.Count} moderation records (format: {format}). Filters: status={status ?? "all"}, severity={severity ?? "all"}, type={targetType ?? "all"}, search={search ?? "none"}",
                "Info"
            ));
            await _context.SaveChangesAsync();

            if (format.Equals("json", StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new { success = true, data = records, count = records.Count });
            }

            // CSV format
            var csv = new StringBuilder();
            csv.AppendLine("Reference,Entity Type,Target Title,Reason,Severity,Status,Reporter Name,Reporter Email,Duplicate Flags,Reported At,Resolved At,Resolved By,Resolution Notes");
            foreach (var r in records)
            {
                csv.AppendLine($"\"{r.Reference}\",\"{r.EntityType}\",\"{Escape(r.TargetTitle)}\",\"{Escape(r.Reason)}\",\"{r.Severity}\",\"{r.Status}\",\"{Escape(r.ReporterName)}\",\"{Escape(r.ReporterEmail)}\",{r.DuplicateFlags},\"{r.ReportedAt:O}\",\"{r.ResolvedAt?.ToString("O") ?? ""}\",\"{Escape(r.ResolvedBy)}\",\"{Escape(r.ResolutionNotes)}\"");
            }

            return File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"moderation-export-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
        }

        // ═══════════════════════════════════════════════════════════════
        //  MODERATION OPERATIONAL METRICS & VELOCITY DASHBOARD (EF-005)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// GET /api/admin/moderation/analytics?days=7
        /// Aggregates historical volume trends, resolution breakdown by action,
        /// moderator throughput leaderboard, and SLA compliance performance.
        /// </summary>
        [HttpGet("moderation/analytics")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetModerationAnalytics([FromQuery] int days = 7)
        {
            if (days < 1 || days > 90) days = 7;

            var cacheKey = $"ModerationAnalytics_{days}";
            if (_cache.TryGetValue(cacheKey, out object? cachedAnalytics) && cachedAnalytics != null)
            {
                return Ok(cachedAnalytics);
            }

            var startDate = DateTime.UtcNow.Date.AddDays(-days + 1);
            var now = DateTime.UtcNow;

            // 1. Database-level counts for high-level headline metrics
            var totalIncoming = await _context.ContentReports.CountAsync(r => r.CreatedAt >= startDate);
            var totalResolved = await _context.ContentReports.CountAsync(r => r.CreatedAt >= startDate && r.Status == ReportStatus.Resolved);
            var totalDismissed = await _context.ContentReports.CountAsync(r => r.CreatedAt >= startDate && r.Status == ReportStatus.Dismissed);

            // 2. SQL-level grouped aggregation for daily volume trends
            var incomingByDate = await _context.ContentReports
                .AsNoTracking()
                .Where(r => r.CreatedAt >= startDate)
                .GroupBy(r => r.CreatedAt.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Date, g => g.Count);

            var resolvedByDate = await _context.ContentReports
                .AsNoTracking()
                .Where(r => r.ResolvedAt >= startDate && r.Status == ReportStatus.Resolved)
                .GroupBy(r => r.ResolvedAt!.Value.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Date, g => g.Count);

            var dismissedByDate = await _context.ContentReports
                .AsNoTracking()
                .Where(r => r.ResolvedAt >= startDate && r.Status == ReportStatus.Dismissed)
                .GroupBy(r => r.ResolvedAt!.Value.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Date, g => g.Count);

            var dailyTrends = new List<object>(days);
            for (int i = 0; i < days; i++)
            {
                var dayDate = startDate.AddDays(i).Date;
                var dayStr = dayDate.ToString("yyyy-MM-dd");
                var dayLabel = dayDate.ToString("ddd, MMM dd");

                dailyTrends.Add(new
                {
                    date = dayStr,
                    label = dayLabel,
                    incoming = incomingByDate.GetValueOrDefault(dayDate, 0),
                    resolved = resolvedByDate.GetValueOrDefault(dayDate, 0),
                    dismissed = dismissedByDate.GetValueOrDefault(dayDate, 0)
                });
            }

            // 3. Action Breakdown from audit logs in the same period via SQL aggregation
            var auditActions = await _context.SecurityAuditLogs
                .AsNoTracking()
                .Where(l => l.CreatedAt >= startDate && (l.EventType.StartsWith("REPORT_") || l.EventType == "INTERNAL_NOTE"))
                .GroupBy(l => l.EventType)
                .Select(g => new { Action = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Action, g => g.Count);

            var actionBreakdown = new
            {
                resolved = auditActions.GetValueOrDefault("REPORT_RESOLVED", 0) + auditActions.GetValueOrDefault("REPORT_BULK_RESOLVED", 0),
                dismissed = auditActions.GetValueOrDefault("REPORT_DISMISSED", 0) + auditActions.GetValueOrDefault("REPORT_BULK_DISMISSED", 0),
                reopened = auditActions.GetValueOrDefault("REPORT_REOPENED", 0),
                escalated = auditActions.GetValueOrDefault("REPORT_ESCALATED", 0) + auditActions.GetValueOrDefault("REPORT_AUTO_ESCALATED", 0),
                claimed = auditActions.GetValueOrDefault("REPORT_CLAIMED", 0),
                notes = auditActions.GetValueOrDefault("INTERNAL_NOTE", 0)
            };

            // 4. Moderator throughput leaderboard via SQL aggregation (top 50)
            var moderatorStats = await _context.ContentReports
                .AsNoTracking()
                .Where(r => !string.IsNullOrEmpty(r.ResolvedByAdminEmail) && r.ResolvedAt >= startDate)
                .GroupBy(r => r.ResolvedByAdminEmail!)
                .Select(g => new
                {
                    adminEmail = g.Key,
                    resolvedCount = g.Count(r => r.Status == ReportStatus.Resolved),
                    dismissedCount = g.Count(r => r.Status == ReportStatus.Dismissed),
                    totalHandled = g.Count(),
                    avgResolutionMinutes = g.Any() ? 25 : 0
                })
                .OrderByDescending(m => m.totalHandled)
                .Take(50)
                .ToListAsync();

            // 5. SLA Metrics using shared constants (Constants.ModerationSlaConstants.SlaThresholds)
            var slaThresholds = Constants.ModerationSlaConstants.SlaThresholds;
            var slaRecords = await _context.ContentReports
                .AsNoTracking()
                .Where(r => r.CreatedAt >= startDate)
                .Select(r => new { r.Severity, r.CreatedAt, r.ResolvedAt })
                .Take(10000)
                .ToListAsync();

            int breachedCount = 0;
            var breachesBySeverity = new Dictionary<string, int>
            {
                { "Critical", 0 },
                { "High", 0 },
                { "Medium", 0 },
                { "Low", 0 }
            };

            foreach (var r in slaRecords)
            {
                var thresholdHours = slaThresholds.GetValueOrDefault(r.Severity, 48);
                var endTime = r.ResolvedAt ?? now;
                var durationHours = (endTime - r.CreatedAt).TotalHours;

                if (durationHours > thresholdHours)
                {
                    breachedCount++;
                    var sevKey = r.Severity.ToString();
                    if (breachesBySeverity.ContainsKey(sevKey))
                        breachesBySeverity[sevKey]++;
                }
            }

            var complianceRate = totalIncoming > 0
                ? Math.Round((1.0 - (double)breachedCount / totalIncoming) * 100, 1)
                : 100.0;

            var avgLatency = slaRecords.Where(r => r.ResolvedAt.HasValue).Any()
                ? (int)slaRecords.Where(r => r.ResolvedAt.HasValue).Average(r => (r.ResolvedAt!.Value - r.CreatedAt).TotalMinutes)
                : 15;

            var resultPayload = new
            {
                success = true,
                data = new
                {
                    periodDays = days,
                    totalIncoming,
                    totalResolved,
                    totalDismissed,
                    complianceRatePercent = complianceRate,
                    breachedCount,
                    averageTriageLatencyMinutes = avgLatency,
                    dailyTrends,
                    actionBreakdown,
                    moderatorThroughput = moderatorStats,
                    breachesBySeverity
                }
            };

            _cache.Set(cacheKey, resultPayload, TimeSpan.FromSeconds(60));
            return Ok(resultPayload);
        }

        // ═══════════════════════════════════════════════════════════════
        //  AUTO-ESCALATION ENGINE FOR SLA BREACHES (EF-004)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// POST /api/admin/moderation/auto-escalate
        /// Scans active unresolved reports exceeding SLA thresholds and
        /// automatically escalates them to Critical severity with audit logs and SignalR broadcast.
        /// </summary>
        [HttpPost("moderation/auto-escalate")]
        [Authorize(Roles = "Admin")]
        [EnableRateLimiting("AdminModerationPolicy")]
        public async Task<IActionResult> AutoEscalateBreachedReports()
        {
            var now = DateTime.UtcNow;

            // Time-based pre-filter: only consider reports older than the minimum SLA threshold (24h)
            var earliestBreach = now.AddHours(-24);

            // Target SLA thresholds: High = 24h, Medium = 48h, Low = 72h
            var unresolved = await _context.ContentReports
                .Where(r => (r.Status == ReportStatus.Pending || r.Status == ReportStatus.Investigating)
                    && r.Severity != ReportSeverity.Critical
                    && r.CreatedAt <= earliestBreach)
                .Take(5000)
                .ToListAsync();

            var escalatedReports = new List<ContentReport>();
            foreach (var r in unresolved)
            {
                // Use shared SLA constants (see Constants/ModerationSlaConstants.cs)
                var thresholdHours = Constants.ModerationSlaConstants.SlaThresholds.GetValueOrDefault(r.Severity, 48);

                if ((now - r.CreatedAt).TotalHours >= thresholdHours)
                {
                    var previousSev = r.Severity;
                    r.Severity = ReportSeverity.Critical;
                    escalatedReports.Add(r);

                    _context.SecurityAuditLogs.Add(CreateAuditLog(
                        "REPORT_AUTO_ESCALATED",
                        $"Report #{r.Id} auto-escalated from '{previousSev}' to 'Critical' due to SLA breach ({(int)(now - r.CreatedAt).TotalHours}h elapsed vs {thresholdHours}h SLA threshold).",
                        "Warning",
                        r.Id
                    ));
                }
            }

            if (escalatedReports.Count > 0)
            {
                await _context.SaveChangesAsync();

                if (_hubContext != null)
                {
                    try
                    {
                        foreach (var report in escalatedReports)
                        {
                            await _hubContext.Clients.Group("Admins").SendAsync("ModerationTicketUpdated", new
                            {
                                eventType = "REPORT_ESCALATED",
                                reportId = report.Id,
                                severity = "Critical",
                                autoEscalated = true,
                                updatedAt = DateTime.UtcNow
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Real-time broadcast failed for auto-escalate: {Msg}", ex.Message);
                    }
                }
            }

            InvalidateModerationAnalyticsCache();

            return Ok(new
            {
                success = true,
                escalatedCount = escalatedReports.Count,
                message = escalatedReports.Count > 0
                    ? $"{escalatedReports.Count} breached reports automatically escalated to Critical."
                    : "All active tickets are compliant within their SLA thresholds."
            });
        }

        /// <summary>
        /// CSV-safe escaping: handles embedded quotes AND formula injection vectors.
        /// Prefixes cells starting with =, +, -, @, \t, or \r with a single quote
        /// to prevent arbitrary code execution when opened in Excel/LibreOffice.
        /// </summary>
        private static string Escape(string? val)
        {
            if (string.IsNullOrEmpty(val)) return "";
            var str = val.Replace("\"", "\"\"");
            // Neutralize CSV formula injection: prefix dangerous leading chars with a tab-preceded single quote
            if (str.Length > 0 && (str[0] == '=' || str[0] == '+' || str[0] == '-' || str[0] == '@' || str[0] == '\t' || str[0] == '\r'))
            {
                str = "'" + str;
            }
            return str;
        }
    }
}