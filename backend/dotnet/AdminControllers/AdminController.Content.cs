using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace CoreApi.Controllers
{
    public partial class AdminController : ControllerBase
    {
        // ═══════════════════════════════════════════════════════════════
        //  REVIEWS MANAGEMENT
        // ═══════════════════════════════════════════════════════════════
        // ... (lines remain untouched)


        [Authorize(Roles = "Admin")]
        [HttpGet("reviews")]
        public async Task<IActionResult> GetReviews(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 15,
            [FromQuery] int? rating = null,
            [FromQuery] string? role = null,
            [FromQuery] string? moderationStatus = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? search = null)
        {
            var query = _context.Reviews.AsQueryable();

            if (startDate.HasValue)
                query = query.Where(r => r.CreatedAt >= startDate.Value.ToUniversalTime());

            if (endDate.HasValue)
                query = query.Where(r => r.CreatedAt <= endDate.Value.ToUniversalTime().Date.AddDays(1));

            if (rating.HasValue)
                query = query.Where(r => r.Rating == rating.Value);
            if (!string.IsNullOrEmpty(role))
                query = query.Where(r => r.UserRole == role);
            if (!string.IsNullOrEmpty(moderationStatus))
            {
                if (moderationStatus.Equals("Approved", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(r => r.ModerationStatus == "Approved" || string.IsNullOrEmpty(r.ModerationStatus));
                }
                else
                {
                    query = query.Where(r => r.ModerationStatus == moderationStatus);
                }
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = $"%{search.Trim()}%";
                query = query.Where(r => EF.Functions.Like(r.AuthorName, pattern) || EF.Functions.Like(r.TargetName, pattern) || EF.Functions.Like(r.Content, pattern));
            }

            var total = await query.CountAsync();
            var reviews = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            return Ok(new { success = true, data = reviews, pagination = new { total, page, limit } });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("reviews/{id}/moderation")]
        public async Task<IActionResult> UpdateReviewModeration(int id, [FromBody] AdminReviewModerationDto dto)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound(new { message = "Review not found." });

            var previousStatus = review.ModerationStatus;

            if (!string.IsNullOrEmpty(dto.ModerationStatus))
                review.ModerationStatus = dto.ModerationStatus;
            if (dto.FlagReason != null)
                review.FlagReason = dto.FlagReason;
            if (dto.AdvocateReply != null)
                review.AdvocateReply = dto.AdvocateReply;
            if (!string.IsNullOrEmpty(dto.AdvocateReplyStatus))
                review.AdvocateReplyStatus = dto.AdvocateReplyStatus;

            // Audit log recording
            var adminIdClaim = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
            int.TryParse(adminIdClaim, out int adminId);
            var adminEmail = User.FindFirstValue(System.Security.Claims.ClaimTypes.Email) ?? "Admin";

            var auditLog = new ReviewAuditLog
            {
                ReviewId = review.Id,
                AdminId = adminId > 0 ? adminId : null,
                AdminEmail = adminEmail,
                Action = dto.ModerationStatus ?? "Updated",
                PreviousStatus = previousStatus,
                NewStatus = review.ModerationStatus,
                ReasonCode = dto.ReasonCode ?? "MANUAL_MODERATION",
                Notes = dto.FlagReason ?? dto.Notes ?? "Moderation status updated by admin.",
                CreatedAt = DateTime.UtcNow
            };
            _context.ReviewAuditLogs.Add(auditLog);

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Review moderation status updated successfully.", data = review });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("reviews/{id}/history")]
        public async Task<IActionResult> GetReviewAuditHistory(int id)
        {
            var logs = await _context.ReviewAuditLogs
                .Where(l => l.ReviewId == id)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync();
            return Ok(new { success = true, data = logs });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("reviews/{id}/redact")]
        public async Task<IActionResult> RedactReviewContent(int id, [FromBody] AdminReviewRedactDto dto)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound(new { message = "Review not found." });

            review.RedactedContent = dto.RedactedContent;

            var adminIdClaim = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
            int.TryParse(adminIdClaim, out int adminId);
            var adminEmail = User.FindFirstValue(System.Security.Claims.ClaimTypes.Email) ?? "Admin";

            _context.ReviewAuditLogs.Add(new ReviewAuditLog
            {
                ReviewId = review.Id,
                AdminId = adminId > 0 ? adminId : null,
                AdminEmail = adminEmail,
                Action = "Redacted",
                PreviousStatus = review.ModerationStatus,
                NewStatus = review.ModerationStatus,
                ReasonCode = dto.ReasonCode ?? "POLICY-103",
                Notes = dto.Notes ?? "PII/Confidential details redacted by moderator.",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Review content sanitized successfully.", data = review });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("reviews/{id}/dispute")]
        public async Task<IActionResult> ResolveReviewDispute(int id, [FromBody] AdminReviewDisputeResolutionDto dto)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound(new { message = "Review not found." });

            var previousStatus = review.ModerationStatus;

            review.IsDisputeRequested = false;
            if (string.Equals(dto.Decision, "Upheld", StringComparison.OrdinalIgnoreCase))
            {
                review.ModerationStatus = "Hidden";
                review.FlagReason = $"Dispute Upheld: {dto.Rationale ?? "Advocate removal request approved"}";
            }
            else
            {
                review.ModerationStatus = "Approved";
                review.FlagReason = $"Dispute Rejected: {dto.Rationale ?? "Review complies with platform guidelines"}";
            }

            var adminIdClaim = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
            int.TryParse(adminIdClaim, out int adminId);
            var adminEmail = User.FindFirstValue(System.Security.Claims.ClaimTypes.Email) ?? "Admin";

            _context.ReviewAuditLogs.Add(new ReviewAuditLog
            {
                ReviewId = review.Id,
                AdminId = adminId > 0 ? adminId : null,
                AdminEmail = adminEmail,
                Action = $"Dispute{dto.Decision}",
                PreviousStatus = previousStatus,
                NewStatus = review.ModerationStatus,
                ReasonCode = "DISPUTE_RESOLUTION",
                Notes = dto.Rationale ?? $"Advocate dispute resolved as {dto.Decision}.",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = $"Dispute resolved as {dto.Decision}.", data = review });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("reviews/{id}")]
        public async Task<IActionResult> DeleteReview(int id)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound(new { message = "Review not found." });

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Review deleted." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  CONSULTATIONS MANAGEMENT
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("consultations")]
        public async Task<IActionResult> GetConsultations(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 15,
            [FromQuery] string? status = null,
            [FromQuery] string? search = null,
            [FromQuery] string? sla = null,
            [FromQuery] string? dateRange = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? sortBy = "createdAt",
            [FromQuery] string? sortOrder = "desc",
            [FromQuery] bool exportAll = false)
        {
            var query = _context.Consultations
                .Include(c => c.Client)
                .Include(c => c.Lawyer)
                .AsQueryable();

            if (startDate.HasValue)
                query = query.Where(c => c.CreatedAt >= startDate.Value.ToUniversalTime());

            if (endDate.HasValue)
                query = query.Where(c => c.CreatedAt <= endDate.Value.ToUniversalTime().AddDays(1));

            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.Status == status);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim().ToLower();
                query = query.Where(c =>
                    (c.ClientName != null && c.ClientName.ToLower().Contains(q)) ||
                    (c.ClientEmail != null && c.ClientEmail.ToLower().Contains(q)) ||
                    (c.Client != null && c.Client.Phone != null && c.Client.Phone.ToLower().Contains(q)) ||
                    (c.Lawyer != null && c.Lawyer.FullName != null && c.Lawyer.FullName.ToLower().Contains(q)) ||
                    (c.Lawyer != null && c.Lawyer.Email != null && c.Lawyer.Email.ToLower().Contains(q)) ||
                    (c.Message != null && c.Message.ToLower().Contains(q))
                );
            }

            // SLA Filter
            if (!string.IsNullOrEmpty(sla))
            {
                var now = DateTime.UtcNow;
                if (sla.Equals("overdue", StringComparison.OrdinalIgnoreCase))
                {
                    var cutoff = now.AddDays(-3);
                    query = query.Where(c => c.CreatedAt <= cutoff && c.Status != "Closed");
                }
                else if (sla.Equals("pending", StringComparison.OrdinalIgnoreCase))
                {
                    var cutoff1 = now.AddDays(-3);
                    var cutoff2 = now.AddDays(-1);
                    query = query.Where(c => c.CreatedAt > cutoff1 && c.CreatedAt <= cutoff2 && c.Status != "Closed");
                }
                else if (sla.Equals("notice", StringComparison.OrdinalIgnoreCase))
                {
                    var cutoff1 = now.AddDays(-1);
                    var cutoff2 = now.AddHours(-6);
                    query = query.Where(c => c.CreatedAt > cutoff1 && c.CreatedAt <= cutoff2 && c.Status != "Closed");
                }
                else if (sla.Equals("recent", StringComparison.OrdinalIgnoreCase))
                {
                    var cutoff = now.AddHours(-6);
                    query = query.Where(c => c.CreatedAt > cutoff);
                }
            }

            // Date Range Filter
            if (!string.IsNullOrEmpty(dateRange))
            {
                var now = DateTime.UtcNow;
                if (dateRange.Equals("today", StringComparison.OrdinalIgnoreCase))
                    query = query.Where(c => c.CreatedAt >= now.Date);
                else if (dateRange.Equals("7days", StringComparison.OrdinalIgnoreCase))
                    query = query.Where(c => c.CreatedAt >= now.AddDays(-7));
                else if (dateRange.Equals("30days", StringComparison.OrdinalIgnoreCase))
                    query = query.Where(c => c.CreatedAt >= now.AddDays(-30));
            }

            // Sorting
            bool isAsc = sortOrder?.ToLower() == "asc";
            query = sortBy?.ToLower() switch
            {
                "clientname" => isAsc ? query.OrderBy(c => c.ClientName) : query.OrderByDescending(c => c.ClientName),
                "lawyername" => isAsc ? query.OrderBy(c => c.Lawyer != null ? c.Lawyer.FullName : string.Empty) : query.OrderByDescending(c => c.Lawyer != null ? c.Lawyer.FullName : string.Empty),
                "status" => isAsc ? query.OrderBy(c => c.Status) : query.OrderByDescending(c => c.Status),
                "sla" => isAsc ? query.OrderBy(c => c.CreatedAt) : query.OrderByDescending(c => c.CreatedAt),
                _ => isAsc ? query.OrderBy(c => c.CreatedAt) : query.OrderByDescending(c => c.CreatedAt),
            };

            var total = await query.CountAsync();

            if (!_cache.TryGetValue("ConsultationMetricsSummary", out Dictionary<string, int>? statusCounts) || statusCounts == null)
            {
                statusCounts = await _context.Consultations.AsNoTracking()
                    .GroupBy(c => c.Status)
                    .Select(g => new { Status = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(g => g.Status ?? "", g => g.Count);

                _cache.Set("ConsultationMetricsSummary", statusCounts, TimeSpan.FromSeconds(30));
            }

            var allCount = statusCounts.Values.Sum();
            var pending = statusCounts.GetValueOrDefault("Pending", 0);
            var contacted = statusCounts.GetValueOrDefault("Contacted", 0);
            var closed = statusCounts.GetValueOrDefault("Closed", 0);

            var queryToExecute = exportAll ? query : query.Skip((page - 1) * limit).Take(limit);

            var consultationsList = await queryToExecute
                .Select(c => new
                {
                    c.Id,
                    c.ClientName,
                    c.ClientEmail,
                    clientPhone = c.Client != null ? c.Client.Phone : null,
                    clientUser = c.Client != null ? c.Client.FullName : null,
                    lawyerName = c.Lawyer != null ? c.Lawyer.FullName : "Unknown Advocate",
                    lawyerEmail = c.Lawyer != null ? c.Lawyer.Email : null,
                    c.Message,
                    c.Status,
                    c.AdminRemark,
                    AuditLogJson = (string?)null, // Omit heavy audit JSON payload in list view
                    c.CreatedAt
                })
                .ToListAsync();

            return Ok(new {
                success = true,
                data = consultationsList,
                pagination = new { total, page, limit },
                metrics = new { total = allCount, pending, contacted, closed }
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("consultations/{id}")]
        public async Task<IActionResult> GetConsultationDetail(int id)
        {
            var consultation = await _context.Consultations
                .Include(c => c.Client)
                .Include(c => c.Lawyer)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id);

            if (consultation == null) return NotFound(new { message = "Consultation not found." });

            return Ok(new
            {
                success = true,
                data = new
                {
                    consultation.Id,
                    consultation.ClientName,
                    consultation.ClientEmail,
                    clientPhone = consultation.Client != null ? consultation.Client.Phone : null,
                    clientUser = consultation.Client != null ? consultation.Client.FullName : null,
                    lawyerName = consultation.Lawyer != null ? consultation.Lawyer.FullName : "Unknown Advocate",
                    lawyerEmail = consultation.Lawyer != null ? consultation.Lawyer.Email : null,
                    consultation.Message,
                    consultation.Status,
                    consultation.AdminRemark,
                    consultation.AuditLogJson,
                    consultation.CreatedAt
                }
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("consultations/{id}/status")]
        public async Task<IActionResult> UpdateConsultationStatus(int id, [FromBody] AdminUpdateStatusDto dto)
        {
            var consultation = await _context.Consultations.FindAsync(id);
            if (consultation == null) return NotFound(new { message = "Consultation not found." });

            var previousStatus = consultation.Status;
            consultation.Status = dto.Status;

            // Audit Log update
            AppendAuditLog(consultation, $"Status updated from '{previousStatus}' to '{dto.Status}'");

            await _context.SaveChangesAsync();

            // Invalidate server-side metrics cache
            _cache.Remove("ConsultationMetricsSummary");

            return Ok(new { success = true, message = "Status updated.", status = dto.Status });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("consultations/bulk-status")]
        public async Task<IActionResult> BulkUpdateConsultationStatus([FromBody] AdminBulkConsultationStatusDto dto)
        {
            if (dto.ConsultationIds == null || !dto.ConsultationIds.Any())
                return BadRequest(new { message = "No consultation IDs provided." });

            var items = await _context.Consultations.Where(c => dto.ConsultationIds.Contains(c.Id)).ToListAsync();
            foreach (var item in items)
            {
                var prev = item.Status;
                item.Status = dto.Status;
                AppendAuditLog(item, $"Bulk status updated from '{prev}' to '{dto.Status}'");
            }

            await _context.SaveChangesAsync();

            // Invalidate server-side metrics cache
            _cache.Remove("ConsultationMetricsSummary");

            return Ok(new { success = true, message = $"Bulk status updated for {items.Count} consultation(s)." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("consultations/{id}/notes")]
        public async Task<IActionResult> UpdateConsultationNotes(int id, [FromBody] AdminUpdateConsultationNotesDto dto)
        {
            var consultation = await _context.Consultations.FindAsync(id);
            if (consultation == null) return NotFound(new { message = "Consultation not found." });

            consultation.AdminRemark = dto.AdminRemark;
            AppendAuditLog(consultation, "Admin internal remark updated.");

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Internal notes saved successfully.", adminRemark = consultation.AdminRemark });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("consultations/{id}/dispatch-email")]
        public async Task<IActionResult> DispatchConsultationEmail(int id, [FromBody] AdminDispatchEmailDto dto)
        {
            var consultation = await _context.Consultations.FindAsync(id);
            if (consultation == null) return NotFound(new { message = "Consultation not found." });

            AppendAuditLog(consultation, $"Quick response email template '{dto.Template}' dispatched to {dto.Recipient}.");
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = $"Quick reply successfully dispatched to {dto.Recipient}." });
        }

        private void AppendAuditLog(Consultation consultation, string actionText)
        {
            var timestamp = DateTime.UtcNow.ToString("o");
            var newEntry = $"{{\"timestamp\":\"{timestamp}\",\"action\":\"{actionText}\"}}";
            if (string.IsNullOrEmpty(consultation.AuditLogJson))
            {
                consultation.AuditLogJson = $"[{newEntry}]";
            }
            else
            {
                try
                {
                    var trimmed = consultation.AuditLogJson.Trim();
                    if (trimmed.EndsWith("]"))
                    {
                        consultation.AuditLogJson = trimmed.Substring(0, trimmed.Length - 1) + $",{newEntry}]";
                    }
                    else
                    {
                        consultation.AuditLogJson = $"[{newEntry}]";
                    }
                }
                catch
                {
                    consultation.AuditLogJson = $"[{newEntry}]";
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  ANNOUNCEMENTS MANAGEMENT
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("announcements")]
        public async Task<IActionResult> GetAnnouncements()
        {
            var announcements = await _context.SystemAnnouncements
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            var results = new List<object>();
            foreach (var a in announcements)
            {
                var readCount = await _context.UserAnnouncementReads.CountAsync(r => r.AnnouncementId == a.Id);
                results.Add(new
                {
                    a.Id,
                    a.Version,
                    a.Title,
                    a.Summary,
                    a.DetailsMarkdown,
                    type = a.Type.ToString(),
                    a.IsModalTrigger,
                    a.IsActive,
                    a.CreatedAt,
                    a.PublishedAt,
                    readCount
                });
            }

            return Ok(new { success = true, data = results });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("announcements")]
        public async Task<IActionResult> CreateAnnouncement([FromBody] AnnouncementCreateDto dto)
        {
            var announcement = new SystemAnnouncement
            {
                Version = dto.Version,
                Title = dto.Title,
                Summary = dto.Summary,
                DetailsMarkdown = dto.DetailsMarkdown,
                Type = dto.Type,
                IsModalTrigger = dto.IsModalTrigger,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                PublishedAt = dto.PublishedAt ?? DateTime.UtcNow
            };

            _context.SystemAnnouncements.Add(announcement);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Announcement created.", id = announcement.Id });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("announcements/{id}")]
        public async Task<IActionResult> UpdateAnnouncement(int id, [FromBody] AnnouncementCreateDto dto)
        {
            var announcement = await _context.SystemAnnouncements.FindAsync(id);
            if (announcement == null) return NotFound(new { message = "Announcement not found." });

            announcement.Version = dto.Version;
            announcement.Title = dto.Title;
            announcement.Summary = dto.Summary;
            announcement.DetailsMarkdown = dto.DetailsMarkdown;
            announcement.Type = dto.Type;
            announcement.IsModalTrigger = dto.IsModalTrigger;
            announcement.IsActive = dto.IsActive;
            if (dto.PublishedAt.HasValue) announcement.PublishedAt = dto.PublishedAt.Value;

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Announcement updated." });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("announcements/{id}")]
        public async Task<IActionResult> DeleteAnnouncement(int id)
        {
            var announcement = await _context.SystemAnnouncements.FindAsync(id);
            if (announcement == null) return NotFound(new { message = "Announcement not found." });

            _context.SystemAnnouncements.Remove(announcement);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Announcement deleted." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  CONTACT SUBMISSIONS
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("contacts")]
        public async Task<IActionResult> GetContactSubmissions(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20,
            [FromQuery] string? status = null,
            [FromQuery] string? priority = null,
            [FromQuery] string? category = null,
            [FromQuery] string? assignedAgent = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? search = null)
        {
            var contactsList = new List<object>();

            // 1. Fetch real MongoDB tickets from Node backend
            try
            {
                var nodeBaseUrl = _configuration["NodeServices:BaseUrl"] ?? "http://localhost:5000";
                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(3);
                var response = await httpClient.GetAsync($"{nodeBaseUrl}/api/legal/contact/all-tickets");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                    if (json.TryGetProperty("tickets", out var ticketsProp) && ticketsProp.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var t in ticketsProp.EnumerateArray())
                        {
                            var tStatus = t.TryGetProperty("status", out var st) ? st.GetString() ?? "New" : "New";
                            if (!string.IsNullOrEmpty(status) && !tStatus.Equals(status, StringComparison.OrdinalIgnoreCase))
                                continue;

                            var tPriority = t.TryGetProperty("priority", out var pr) ? pr.GetString() ?? "Normal" : "Normal";
                            if (!string.IsNullOrEmpty(priority) && !tPriority.Equals(priority, StringComparison.OrdinalIgnoreCase))
                                continue;

                            var tCategory = t.TryGetProperty("category", out var cat) ? cat.GetString() ?? "General" : "General";
                            if (!string.IsNullOrEmpty(category) && !tCategory.Equals(category, StringComparison.OrdinalIgnoreCase))
                                continue;

                            var tName = t.TryGetProperty("name", out var n) ? n.GetString() ?? "User" : "User";
                            var tEmail = t.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
                            var tSubject = t.TryGetProperty("subject", out var s) ? s.GetString() ?? "Inquiry" : "Inquiry";
                            var tMsg = t.TryGetProperty("message", out var m) ? m.GetString() ?? "" : "";

                            var tsStr = t.TryGetProperty("timestamp", out var ts) ? ts.GetString() : null;
                            if (DateTime.TryParse(tsStr, out var ticketDt))
                            {
                                var ticketUtc = ticketDt.ToUniversalTime();
                                if (startDate.HasValue && ticketUtc < startDate.Value.ToUniversalTime()) continue;
                                if (endDate.HasValue && ticketUtc > endDate.Value.ToUniversalTime().Date.AddDays(1)) continue;
                            }

                            if (!string.IsNullOrWhiteSpace(search))
                            {
                                var q = search.Trim().ToLower();
                                if (!tName.ToLower().Contains(q) && !tEmail.ToLower().Contains(q) && !tSubject.ToLower().Contains(q) && !tMsg.ToLower().Contains(q))
                                    continue;
                            }

                            contactsList.Add(new
                            {
                                id = t.TryGetProperty("ticketId", out var tid) ? tid.GetString() : Guid.NewGuid().ToString("N"),
                                fullName = tName,
                                email = tEmail,
                                subject = tSubject,
                                message = tMsg,
                                status = tStatus,
                                priority = tPriority,
                                category = tCategory,
                                source = "MongoDB Desk",
                                assignedAgent = t.TryGetProperty("assignedAgent", out var ag) ? ag.GetString() : "",
                                slaTarget = t.TryGetProperty("slaTarget", out var sla) ? sla.GetString() : "24 Hours",
                                createdAt = tsStr ?? DateTime.UtcNow.ToString("o")
                            });
                        }
                    }
                }
            }
            catch {}

            // 2. Fetch MySQL ContactSubmissions
            var query = _context.ContactSubmissions.AsQueryable();
            if (startDate.HasValue)
                query = query.Where(c => c.CreatedAt >= startDate.Value.ToUniversalTime());
            if (endDate.HasValue)
                query = query.Where(c => c.CreatedAt <= endDate.Value.ToUniversalTime().Date.AddDays(1));
            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.Status == status);
            if (!string.IsNullOrEmpty(priority))
                query = query.Where(c => c.Priority == priority);
            if (!string.IsNullOrEmpty(category))
                query = query.Where(c => c.Category == category);
            if (!string.IsNullOrEmpty(assignedAgent))
                query = query.Where(c => c.AssignedAgent == assignedAgent);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim().ToLower();
                query = query.Where(c => c.FullName.ToLower().Contains(q) || c.Email.ToLower().Contains(q) || c.Subject.ToLower().Contains(q) || c.Message.ToLower().Contains(q));
            }

            var sqlContacts = await query
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    id = c.Id.ToString(),
                    fullName = c.FullName,
                    email = c.Email,
                    subject = c.Subject,
                    message = c.Message,
                    status = c.Status,
                    priority = c.Priority ?? "Normal",
                    category = c.Category ?? "General",
                    source = "SQL Contact Desk",
                    assignedAgent = c.AssignedAgent ?? "",
                    slaDueDate = c.SlaDueDate.HasValue ? c.SlaDueDate.Value.ToString("o") : null,
                    resolutionNote = c.ResolutionNote ?? "",
                    internalNotesJson = c.InternalNotesJson ?? "[]",
                    createdAt = c.CreatedAt.ToString("o")
                })
                .ToListAsync();

            contactsList.AddRange(sqlContacts);

            var total = contactsList.Count;
            var paged = contactsList.Skip((page - 1) * limit).Take(limit).ToList();

            return Ok(new { success = true, data = paged, pagination = new { total, page, limit } });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("contacts/{id}/status")]
        public async Task<IActionResult> UpdateContactStatus(int id, [FromBody] AdminUpdateTicketDto dto)
        {
            var contact = await _context.ContactSubmissions.FindAsync(id);
            if (contact == null) return NotFound(new { message = "Contact submission not found." });

            if (!string.IsNullOrEmpty(dto.Status))
                contact.Status = dto.Status;
            if (!string.IsNullOrEmpty(dto.Priority))
                contact.Priority = dto.Priority;
            if (!string.IsNullOrEmpty(dto.Category))
                contact.Category = dto.Category;
            if (dto.AssignedAgent != null)
                contact.AssignedAgent = dto.AssignedAgent;
            if (dto.ResolutionNote != null)
                contact.ResolutionNote = dto.ResolutionNote;
            if (dto.InternalNotesJson != null)
                contact.InternalNotesJson = dto.InternalNotesJson;

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Contact ticket updated successfully.", data = contact });
        }
    }
}