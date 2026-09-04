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

namespace CoreApi.AdminControllers
{
    [Route("api/admin/notification")]
    [Route("api/Notification")]
    [ApiController]
    public class AdminNotificationController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AdminNotificationController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(claim, out int userId))
            {
                return userId;
            }
            return null;
        }

        /// <summary>
        /// Auto-sync: Creates AdminNotification rows for any unverified lawyers or contact submissions
        /// that don't already have corresponding notification records. Runs before stream queries.
        /// </summary>
        private async Task AutoSyncDomainEvents()
        {
            // 1. Sync unverified lawyer profiles
            var pendingLawyers = await _context.LawyerProfiles
                .Include(l => l.User)
                .Where(l => !l.IsVerified)
                .Select(l => new { l.Id, FullName = l.User != null ? l.User.FullName : "Lawyer Practitioner", l.BarCouncilNumber, l.City, l.UpdatedAt })
                .ToListAsync();

            var existingLawyerNotifIds = await _context.AdminNotifications
                .Where(n => n.RelatedEntityType == "LawyerProfile" && n.Type == "verification_req")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            foreach (var l in pendingLawyers)
            {
                if (!existingLawyerNotifIds.Contains(l.Id))
                {
                    _context.AdminNotifications.Add(new AdminNotification
                    {
                        TargetRole = "VerificationOfficer",
                        Type = "verification_req",
                        Severity = "warning",
                        Category = "verification",
                        Title = "Bar Credential Audit Pending",
                        Message = $"Adv. {l.FullName} submitted license ({l.BarCouncilNumber ?? "Pending"}) under {l.City ?? "Bar Council"}.",
                        CreatedAt = l.UpdatedAt,
                        ActionUrl = "/lawyers",
                        ActionLabel = "Audit License",
                        Source = "Lawyer Verification",
                        RelatedEntityType = "LawyerProfile",
                        RelatedEntityId = l.Id
                    });
                }
            }

            // 2. Sync contact submissions / grievance tickets
            var recentTickets = await _context.ContactSubmissions
                .OrderByDescending(c => c.CreatedAt)
                .Take(50)
                .Select(c => new { c.Id, c.FullName, c.Subject, c.Message, c.CreatedAt })
                .ToListAsync();

            var existingTicketNotifIds = await _context.AdminNotifications
                .Where(n => n.RelatedEntityType == "ContactSubmission" && n.Type == "urgent_ticket")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            foreach (var t in recentTickets)
            {
                if (!existingTicketNotifIds.Contains(t.Id))
                {
                    _context.AdminNotifications.Add(new AdminNotification
                    {
                        TargetRole = "SupportDesk",
                        Type = "urgent_ticket",
                        Severity = "warning",
                        Category = "support",
                        Title = $"Grievance Ticket #{t.Id}: {t.Subject}",
                        Message = $"Submitted by {t.FullName}: {t.Message}",
                        CreatedAt = t.CreatedAt,
                        ActionUrl = "/support",
                        ActionLabel = "Open Grievance Desk",
                        Source = "Support Desk",
                        RelatedEntityType = "ContactSubmission",
                        RelatedEntityId = t.Id
                    });
                }
            }

            // 3. Sync recent consultations
            var recentConsultations = await _context.Consultations
                .Include(c => c.Lawyer)
                .OrderByDescending(c => c.CreatedAt)
                .Take(30)
                .Select(c => new { c.Id, c.ClientName, LawyerName = c.Lawyer != null ? c.Lawyer.FullName : "Advocate", c.Status, c.CreatedAt })
                .ToListAsync();

            var existingConsultNotifIds = await _context.AdminNotifications
                .Where(n => n.RelatedEntityType == "Consultation" && n.Type == "consultation_alert")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            foreach (var c in recentConsultations)
            {
                if (!existingConsultNotifIds.Contains(c.Id))
                {
                    _context.AdminNotifications.Add(new AdminNotification
                    {
                        TargetRole = "All",
                        Type = "consultation_alert",
                        Severity = "info",
                        Category = "consultation",
                        Title = $"Consultation #{c.Id} - {c.Status}",
                        Message = $"Client {c.ClientName} booked session with Adv. {c.LawyerName}.",
                        CreatedAt = c.CreatedAt,
                        IsRead = true,
                        ActionUrl = "/consultations",
                        ActionLabel = "Track Booking",
                        Source = "Consultation System",
                        RelatedEntityType = "Consultation",
                        RelatedEntityId = c.Id
                    });
                }
            }

            // 4. Sync system announcements
            var announcements = await _context.SystemAnnouncements
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.PublishedAt)
                .Take(50)
                .ToListAsync();

            var existingAnnNotifIds = await _context.AdminNotifications
                .Where(n => n.RelatedEntityType == "SystemAnnouncement" && n.Type == "announcement")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            var userId = GetCurrentUserId();
            List<UserAnnouncementRead> userReads = new();
            if (userId.HasValue)
            {
                var annIds = announcements.Select(a => a.Id).ToList();
                userReads = await _context.UserAnnouncementReads
                    .Where(r => r.UserId == userId.Value && annIds.Contains(r.AnnouncementId))
                    .ToListAsync();
            }

            foreach (var a in announcements)
            {
                if (!existingAnnNotifIds.Contains(a.Id))
                {
                    var read = userReads.Any(r => r.AnnouncementId == a.Id);
                    _context.AdminNotifications.Add(new AdminNotification
                    {
                        TargetRole = "All",
                        Type = "announcement",
                        Severity = a.Type == AnnouncementType.SecurityPatch ? "critical" :
                                   a.Type == AnnouncementType.MajorRelease ? "info" : "warning",
                        Category = "announcement",
                        Title = a.Title,
                        Message = a.Summary,
                        DetailsMarkdown = a.DetailsMarkdown,
                        CreatedAt = a.PublishedAt,
                        IsRead = read,
                        ActionUrl = "/announcements",
                        ActionLabel = "View Release Notes",
                        Source = "System Broadcast",
                        RelatedEntityType = "SystemAnnouncement",
                        RelatedEntityId = a.Id
                    });
                }
            }

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Primary notification stream endpoint. Queries persistent AdminNotifications table.
        /// Supports server-side pagination, search, severity/category/role filters, tab filters, and date ranges.
        /// </summary>
        [HttpGet("stream")]
        public async Task<IActionResult> GetTelemetryStream([FromQuery] NotificationQueryDto query)
        {
            // Base query — all non-archived for global KPIs
            var allQuery = _context.AdminNotifications.AsNoTracking();

            // Aggregated stats via a single database query instead of 7 roundtrips
            var rawCounts = await allQuery
                .Where(e => !e.IsArchived)
                .GroupBy(e => new { e.Severity, e.IsRead, e.IsStarred })
                .Select(g => new { g.Key.Severity, g.Key.IsRead, g.Key.IsStarred, Count = g.Count() })
                .ToListAsync();

            int totalCount = rawCounts.Sum(c => c.Count);
            int unreadCount = rawCounts.Where(c => !c.IsRead).Sum(c => c.Count);
            int criticalCount = rawCounts.Where(c => c.Severity == "critical").Sum(c => c.Count);
            int starredCount = rawCounts.Where(c => c.IsStarred).Sum(c => c.Count);

            // Severity distribution
            int crit = criticalCount;
            int warn = rawCounts.Where(c => c.Severity == "warning").Sum(c => c.Count);
            int inf = rawCounts.Where(c => c.Severity == "info").Sum(c => c.Count);
            int succ = rawCounts.Where(c => c.Severity == "success").Sum(c => c.Count);
            int sumSev = totalCount > 0 ? totalCount : 1;

            // Security audit stats
            int securityEventsTotal = await _context.SecurityAuditLogs.CountAsync();
            var lastSecurityEvent = await _context.SecurityAuditLogs
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            // Build filtered query
            IQueryable<AdminNotification> filtered = allQuery;

            // Tab filter
            if (!string.IsNullOrEmpty(query.Tab) && query.Tab != "all")
            {
                filtered = query.Tab switch
                {
                    "unread" => filtered.Where(e => !e.IsRead && !e.IsArchived),
                    "starred" => filtered.Where(e => e.IsStarred && !e.IsArchived),
                    "archived" => filtered.Where(e => e.IsArchived),
                    _ => filtered.Where(e => !e.IsArchived)
                };
            }
            else
            {
                filtered = filtered.Where(e => !e.IsArchived);
            }

            // Severity filter
            if (!string.IsNullOrEmpty(query.Severity) && query.Severity != "all")
            {
                filtered = filtered.Where(e => e.Severity == query.Severity);
            }

            // Category filter
            if (!string.IsNullOrEmpty(query.Category) && query.Category != "all")
            {
                filtered = filtered.Where(e => e.Category == query.Category);
            }

            // Role filter
            if (!string.IsNullOrEmpty(query.TargetRole) && query.TargetRole != "all")
            {
                filtered = filtered.Where(e => e.TargetRole == query.TargetRole || e.TargetRole == "All");
            }

            // Search filter
            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                var q = query.Search.Trim().ToLower();
                filtered = filtered.Where(e =>
                    e.Title.ToLower().Contains(q) ||
                    e.Message.ToLower().Contains(q) ||
                    (e.Source != null && e.Source.ToLower().Contains(q))
                );
            }

            // Date range filter
            if (query.StartDate.HasValue)
            {
                filtered = filtered.Where(e => e.CreatedAt >= query.StartDate.Value);
            }
            if (query.EndDate.HasValue)
            {
                var endOfDay = query.EndDate.Value.Date.AddDays(1).AddTicks(-1);
                filtered = filtered.Where(e => e.CreatedAt <= endOfDay);
            }

            // Sorting
            var sort = query.SortBy?.ToLower() ?? "newest";
            if (sort == "oldest")
            {
                filtered = filtered.OrderBy(e => e.CreatedAt);
            }
            else if (sort == "severity")
            {
                filtered = filtered.OrderByDescending(e =>
                    e.Severity == "critical" ? 4 :
                    e.Severity == "warning" ? 3 :
                    e.Severity == "info" ? 2 :
                    e.Severity == "success" ? 1 : 0
                ).ThenByDescending(e => e.CreatedAt);
            }
            else
            {
                filtered = filtered.OrderByDescending(e => e.CreatedAt);
            }

            // Pagination
            int totalFiltered = await filtered.CountAsync();
            int limit = query.Limit > 0 ? query.Limit : 10;
            int page = query.Page > 0 ? query.Page : 1;
            int totalPages = (int)Math.Ceiling((double)totalFiltered / limit);
            if (totalPages < 1) totalPages = 1;

            var pagedNotifications = await filtered
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            // Map to stream event items
            var pagedEvents = pagedNotifications.Select(n => new StreamEventItem
            {
                Id = $"notif-{n.Id}",
                BackendId = n.Id,
                Type = n.Type,
                Severity = n.Severity,
                Category = n.Category,
                Title = n.Title,
                Message = n.Message,
                DetailsMarkdown = n.DetailsMarkdown,
                Timestamp = n.CreatedAt,
                Read = n.IsRead,
                Starred = n.IsStarred,
                Archived = n.IsArchived,
                Link = n.ActionUrl,
                ActionLabel = n.ActionLabel,
                Source = n.Source,
                RelatedEntityType = n.RelatedEntityType,
                RelatedEntityId = n.RelatedEntityId,
                TargetRole = n.TargetRole
            }).ToList();

            return Ok(new
            {
                success = true,
                events = pagedEvents,
                pagination = new { page, limit, total = totalFiltered, pages = totalPages },
                stats = new { totalEvents = totalCount, unreadCount, criticalCount, starredCount },
                severityStats = new
                {
                    critical = crit, warning = warn, info = inf, success = succ,
                    criticalPct = (int)Math.Round((double)crit / sumSev * 100),
                    warningPct = (int)Math.Round((double)warn / sumSev * 100),
                    infoPct = (int)Math.Round((double)inf / sumSev * 100),
                    successPct = (int)Math.Round((double)succ / sumSev * 100)
                },
                securityHealth = new
                {
                    totalSecurityEvents = securityEventsTotal,
                    lastEventAt = lastSecurityEvent == default ? (DateTime?)null : lastSecurityEvent
                }
            });
        }

        /// <summary>
        /// Super Admin endpoint to broadcast targeted notifications platform-wide.
        /// </summary>
        [HttpPost("broadcast")]
        public async Task<IActionResult> DispatchBroadcast([FromBody] BroadcastNotificationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Summary))
            {
                return BadRequest(new { success = false, message = "Title and Summary are required for notification dispatch." });
            }

            var announcementType = dto.Severity.ToLower() switch
            {
                "critical" => AnnouncementType.SecurityPatch,
                "warning" => AnnouncementType.MajorBugFix,
                "success" => AnnouncementType.MajorRelease,
                _ => AnnouncementType.Maintenance
            };

            var announcement = new SystemAnnouncement
            {
                Version = "1.2.0",
                Title = dto.Title.Trim(),
                Summary = dto.Summary.Trim(),
                DetailsMarkdown = dto.DetailsMarkdown ?? dto.Summary,
                Type = announcementType,
                IsModalTrigger = dto.IsModalTrigger,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                PublishedAt = DateTime.UtcNow
            };

            _context.SystemAnnouncements.Add(announcement);
            await _context.SaveChangesAsync();

            // Also create a persistent AdminNotification
            var notif = new AdminNotification
            {
                TargetRole = "All",
                Type = "announcement",
                Severity = dto.Severity,
                Category = dto.Category,
                Title = announcement.Title,
                Message = announcement.Summary,
                DetailsMarkdown = announcement.DetailsMarkdown,
                CreatedAt = DateTime.UtcNow,
                IsStarred = true,
                ActionUrl = "/announcements",
                ActionLabel = "View Release Notes",
                Source = $"Broadcaster ({dto.TargetCohort.ToUpper()})",
                RelatedEntityType = "SystemAnnouncement",
                RelatedEntityId = announcement.Id
            };
            _context.AdminNotifications.Add(notif);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Notification broadcast successfully dispatched to cohort '{dto.TargetCohort.ToUpper()}'!",
                data = new StreamEventItem
                {
                    Id = $"notif-{notif.Id}",
                    BackendId = notif.Id,
                    Type = "announcement",
                    Severity = dto.Severity,
                    Category = dto.Category,
                    Title = announcement.Title,
                    Message = announcement.Summary,
                    DetailsMarkdown = announcement.DetailsMarkdown,
                    Timestamp = announcement.PublishedAt,
                    Read = false,
                    Starred = true,
                    Archived = false,
                    Link = "/announcements",
                    ActionLabel = "View Release Notes",
                    Source = "Super Admin Dispatcher"
                }
            });
        }

        /// <summary>
        /// Mark a single notification as read with persistent DB update.
        /// </summary>
        [HttpPost("mark-read/{id}")]
        public async Task<IActionResult> MarkRead(string id)
        {
            var userId = GetCurrentUserId();
            var notifId = ExtractNotifId(id);

            if (notifId.HasValue)
            {
                var notif = await _context.AdminNotifications.FindAsync(notifId.Value);
                if (notif != null)
                {
                    notif.IsRead = true;
                    notif.ReadAt = DateTime.UtcNow;
                    notif.ReadByUserId = userId;
                    await _context.SaveChangesAsync();
                }
            }

            return Ok(new { success = true, id, message = "Notification marked as read." });
        }

        /// <summary>
        /// Mark ALL unread notifications as read across the entire database via EF Core 8 direct update.
        /// </summary>
        [HttpPost("mark-all-read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = GetCurrentUserId();
            var now = DateTime.UtcNow;

            var unreadQuery = _context.AdminNotifications.Where(n => !n.IsRead && !n.IsArchived);
            var unreadIds = await unreadQuery.Select(n => $"notif-{n.Id}").ToListAsync();

            int updatedCount = await unreadQuery.ExecuteUpdateAsync(s => s
                .SetProperty(n => n.IsRead, true)
                .SetProperty(n => n.ReadAt, n => n.ReadAt ?? now)
                .SetProperty(n => n.ReadByUserId, n => n.ReadByUserId ?? userId));

            return Ok(new
            {
                success = true,
                count = updatedCount,
                unreadIds = unreadIds,
                message = $"Successfully marked {updatedCount} notifications as read."
            });
        }

        /// <summary>
        /// Toggle star status on a single notification.
        /// </summary>
        [HttpPost("toggle-star/{id}")]
        public async Task<IActionResult> ToggleStar(string id)
        {
            var notifId = ExtractNotifId(id);

            if (notifId.HasValue)
            {
                var notif = await _context.AdminNotifications.FindAsync(notifId.Value);
                if (notif != null)
                {
                    notif.IsStarred = !notif.IsStarred;
                    await _context.SaveChangesAsync();
                    return Ok(new { success = true, id, starred = notif.IsStarred });
                }
            }

            return Ok(new { success = true, id });
        }

        /// <summary>
        /// Perform bulk actions (mark_read, mark_unread, delete, archive, unarchive) using EF Core 8 ExecuteUpdate/ExecuteDelete.
        /// </summary>
        [HttpPost("bulk-action")]
        public async Task<IActionResult> BulkAction([FromBody] BulkNotificationActionDto dto)
        {
            if (dto.Ids == null || !dto.Ids.Any())
            {
                return BadRequest(new { success = false, message = "No notification IDs provided." });
            }

            var userId = GetCurrentUserId();
            var notifIds = dto.Ids
                .Select(ExtractNotifId)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .ToList();

            int processedCount = 0;

            if (notifIds.Any())
            {
                var query = _context.AdminNotifications.Where(n => notifIds.Contains(n.Id));
                var now = DateTime.UtcNow;

                switch (dto.Action)
                {
                    case "mark_read":
                        processedCount = await query.ExecuteUpdateAsync(s => s
                            .SetProperty(n => n.IsRead, true)
                            .SetProperty(n => n.ReadAt, n => n.ReadAt ?? now)
                            .SetProperty(n => n.ReadByUserId, n => n.ReadByUserId ?? userId));
                        break;

                    case "mark_unread":
                        processedCount = await query.ExecuteUpdateAsync(s => s
                            .SetProperty(n => n.IsRead, false)
                            .SetProperty(n => n.ReadAt, (DateTime?)null)
                            .SetProperty(n => n.ReadByUserId, (int?)null));
                        break;

                    case "archive":
                        processedCount = await query.ExecuteUpdateAsync(s => s
                            .SetProperty(n => n.IsArchived, true));
                        break;

                    case "unarchive":
                        processedCount = await query.ExecuteUpdateAsync(s => s
                            .SetProperty(n => n.IsArchived, false));
                        break;

                    case "delete":
                        processedCount = await query.ExecuteDeleteAsync();
                        break;
                }
            }

            return Ok(new
            {
                success = true,
                action = dto.Action,
                processedCount = processedCount,
                message = $"Successfully processed {processedCount} notifications with action '{dto.Action}'."
            });
        }

        /// <summary>
        /// Inline 1-click quick action: Perform domain action (approve/reject lawyer, resolve ticket)
        /// AND archive the notification in a single round-trip.
        /// </summary>
        [HttpPost("{id}/quick-action")]
        public async Task<IActionResult> QuickAction(string id, [FromBody] QuickActionDto dto)
        {
            var notifId = ExtractNotifId(id);
            if (!notifId.HasValue)
            {
                return BadRequest(new { success = false, message = "Invalid notification ID." });
            }

            var notif = await _context.AdminNotifications.FindAsync(notifId.Value);
            if (notif == null)
            {
                return NotFound(new { success = false, message = "Notification not found." });
            }

            string resultMessage = "Action completed.";

            switch (dto.ActionType)
            {
                case "approve_lawyer":
                    if (notif.RelatedEntityType == "LawyerProfile" && notif.RelatedEntityId.HasValue)
                    {
                        var lawyer = await _context.LawyerProfiles.FindAsync(notif.RelatedEntityId.Value);
                        if (lawyer != null)
                        {
                            lawyer.IsVerified = true;
                            lawyer.VerificationRemarks = dto.Remarks ?? "Approved via notification quick action.";
                            resultMessage = $"Lawyer (ID: {lawyer.Id}) verified successfully.";

                            // Create success notification
                            _context.AdminNotifications.Add(new AdminNotification
                            {
                                TargetRole = "All",
                                Type = "verification_req",
                                Severity = "success",
                                Category = "verification",
                                Title = "Lawyer License Approved",
                                Message = resultMessage,
                                CreatedAt = DateTime.UtcNow,
                                IsRead = true,
                                ActionUrl = "/lawyers",
                                ActionLabel = "View Lawyer",
                                Source = "Quick Action",
                                RelatedEntityType = "LawyerProfile",
                                RelatedEntityId = lawyer.Id
                            });
                        }
                    }
                    break;

                case "reject_lawyer":
                    if (notif.RelatedEntityType == "LawyerProfile" && notif.RelatedEntityId.HasValue)
                    {
                        var lawyer = await _context.LawyerProfiles.FindAsync(notif.RelatedEntityId.Value);
                        if (lawyer != null)
                        {
                            lawyer.VerificationRemarks = dto.Remarks ?? "Rejected via notification quick action.";
                            resultMessage = $"Lawyer (ID: {lawyer.Id}) verification rejected.";
                        }
                    }
                    break;

                case "resolve_ticket":
                    if (notif.RelatedEntityType == "ContactSubmission" && notif.RelatedEntityId.HasValue)
                    {
                        var ticket = await _context.ContactSubmissions.FindAsync(notif.RelatedEntityId.Value);
                        if (ticket != null)
                        {
                            ticket.Status = "Resolved";
                            resultMessage = $"Support ticket #{ticket.Id} resolved.";
                        }
                    }
                    break;

                default:
                    return BadRequest(new { success = false, message = $"Unknown action type: {dto.ActionType}" });
            }

            // Archive the notification after action
            notif.IsRead = true;
            notif.IsArchived = true;
            notif.ReadAt = DateTime.UtcNow;
            notif.ReadByUserId = GetCurrentUserId();

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = resultMessage, notificationId = id });
        }

        /// <summary>
        /// Get security audit health summary for sidebar widget.
        /// </summary>
        [HttpGet("security-health")]
        public async Task<IActionResult> GetSecurityHealth()
        {
            var now = DateTime.UtcNow;
            var last24h = now.AddHours(-24);

            var totalEvents = await _context.SecurityAuditLogs.CountAsync();
            var last24hEvents = await _context.SecurityAuditLogs.CountAsync(s => s.CreatedAt >= last24h);
            var criticalEvents = await _context.SecurityAuditLogs.CountAsync(s => s.Severity == "critical");
            var lastEvent = await _context.SecurityAuditLogs
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            return Ok(new
            {
                success = true,
                health = new
                {
                    totalEvents,
                    last24hEvents,
                    criticalEvents,
                    lastEventAt = lastEvent?.CreatedAt,
                    lastEventType = lastEvent?.EventType,
                    status = criticalEvents == 0 ? "healthy" : "alert"
                }
            });
        }

        /// <summary>
        /// Extracts the numeric ID from notification string IDs like "notif-42", "ann-5", "lawyer-verif-3".
        /// </summary>
        private static int? ExtractNotifId(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;

            if (id.StartsWith("notif-") && int.TryParse(id.Replace("notif-", ""), out int notifId))
            {
                return notifId;
            }

            if (int.TryParse(id, out int directId))
            {
                return directId;
            }

            return null;
        }
    }
}