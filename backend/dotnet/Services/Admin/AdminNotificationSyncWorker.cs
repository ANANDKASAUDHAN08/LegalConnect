using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using CoreApi.Models.Admin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services.Admin
{
    /// <summary>
    /// Background Hosted Service that periodically synchronizes domain events (unverified lawyers,
    /// pending support tickets, recent consultations, and announcements) into persistent AdminNotification rows.
    /// Runs on a 60-second background cycle to keep notification feeds updated without overhead on GET requests.
    /// </summary>
    public class AdminNotificationSyncWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<AdminNotificationSyncWorker> _logger;
        private readonly TimeSpan _syncInterval = TimeSpan.FromSeconds(60);

        public AdminNotificationSyncWorker(
            IServiceProvider serviceProvider,
            ILogger<AdminNotificationSyncWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🚀 AdminNotificationSyncWorker started. Syncing domain events every {Interval}s.", _syncInterval.TotalSeconds);

            // Initial run after short startup delay
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PerformDomainSyncAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error occurred during background AdminNotification domain sync.");
                }

                await Task.Delay(_syncInterval, stoppingToken);
            }
        }

        public async Task PerformDomainSyncAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // 1. Sync unverified lawyer profiles
            var pendingLawyers = await db.LawyerProfiles
                .Include(l => l.User)
                .Where(l => !l.IsVerified)
                .Select(l => new { l.Id, FullName = l.User != null ? l.User.FullName : "Lawyer Practitioner", l.BarCouncilNumber, l.City, l.UpdatedAt })
                .ToListAsync();

            var existingLawyerNotifIds = await db.AdminNotifications
                .Where(n => n.RelatedEntityType == "LawyerProfile" && n.Type == "verification_req")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            int addedCount = 0;
            foreach (var l in pendingLawyers)
            {
                if (!existingLawyerNotifIds.Contains(l.Id))
                {
                    db.AdminNotifications.Add(new AdminNotification
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
                    addedCount++;
                }
            }

            // 2. Sync contact submissions / grievance tickets
            var recentTickets = await db.ContactSubmissions
                .OrderByDescending(c => c.CreatedAt)
                .Take(50)
                .Select(c => new { c.Id, c.FullName, c.Subject, c.Message, c.CreatedAt })
                .ToListAsync();

            var existingTicketNotifIds = await db.AdminNotifications
                .Where(n => n.RelatedEntityType == "ContactSubmission" && n.Type == "urgent_ticket")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            foreach (var t in recentTickets)
            {
                if (!existingTicketNotifIds.Contains(t.Id))
                {
                    db.AdminNotifications.Add(new AdminNotification
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
                    addedCount++;
                }
            }

            // 3. Sync recent consultations
            var recentConsultations = await db.Consultations
                .Include(c => c.Lawyer)
                .OrderByDescending(c => c.CreatedAt)
                .Take(30)
                .Select(c => new { c.Id, c.ClientName, LawyerName = c.Lawyer != null ? c.Lawyer.FullName : "Advocate", c.Status, c.CreatedAt })
                .ToListAsync();

            var existingConsultNotifIds = await db.AdminNotifications
                .Where(n => n.RelatedEntityType == "Consultation" && n.Type == "consultation_alert")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            foreach (var c in recentConsultations)
            {
                if (!existingConsultNotifIds.Contains(c.Id))
                {
                    db.AdminNotifications.Add(new AdminNotification
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
                    addedCount++;
                }
            }

            // 4. Sync system announcements
            var announcements = await db.SystemAnnouncements
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.PublishedAt)
                .Take(50)
                .ToListAsync();

            var existingAnnNotifIds = await db.AdminNotifications
                .Where(n => n.RelatedEntityType == "SystemAnnouncement" && n.Type == "announcement")
                .Select(n => n.RelatedEntityId)
                .ToListAsync();

            foreach (var a in announcements)
            {
                if (!existingAnnNotifIds.Contains(a.Id))
                {
                    db.AdminNotifications.Add(new AdminNotification
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
                        IsRead = false,
                        ActionUrl = "/announcements",
                        ActionLabel = "View Release Notes",
                        Source = "System Broadcast",
                        RelatedEntityType = "SystemAnnouncement",
                        RelatedEntityId = a.Id
                    });
                    addedCount++;
                }
            }

            if (addedCount > 0)
            {
                await db.SaveChangesAsync();
                _logger.LogInformation("✅ AdminNotificationSyncWorker synced {Count} new domain event notifications.", addedCount);
            }
        }
    }
}