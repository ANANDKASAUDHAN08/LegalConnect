using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models.Admin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services.Admin
{
    /// <summary>
    /// Background hosted service that periodically checks for unacknowledged critical admin notifications.
    /// If critical alerts have been sitting unread for 30+ minutes and no admin has been active,
    /// it dispatches an email digest summary via the existing EmailService (SendGrid).
    /// </summary>
    public class AdminNotificationDigestService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AdminNotificationDigestService> _logger;
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(30);
        private static readonly TimeSpan StalenessThreshold = TimeSpan.FromMinutes(30);

        public AdminNotificationDigestService(
            IServiceScopeFactory scopeFactory,
            ILogger<AdminNotificationDigestService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("📧 AdminNotificationDigestService started. Checking every {Interval} minutes.", CheckInterval.TotalMinutes);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndDispatchDigest(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "AdminNotificationDigestService encountered an error during digest check.");
                }

                await Task.Delay(CheckInterval, stoppingToken);
            }
        }

        private async Task CheckAndDispatchDigest(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
            var configuration = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();

            var staleCutoff = DateTime.UtcNow.Subtract(StalenessThreshold);

            // 1. Check for unread critical notifications older than threshold
            var unreadCriticals = await context.AdminNotifications
                .Where(n => !n.IsRead && !n.IsArchived && n.Severity == "critical" && n.CreatedAt <= staleCutoff)
                .OrderByDescending(n => n.CreatedAt)
                .Take(20)
                .ToListAsync(ct);

            if (!unreadCriticals.Any())
            {
                return; // No stale critical alerts — nothing to do
            }

            // 2. Check if any admin has been active recently
            var recentLoginCutoff = DateTime.UtcNow.AddMinutes(-15);
            var recentAdminActivity = await context.LoginHistories
                .Join(context.Users.Where(u => u.Role == "Admin"), h => h.UserId, u => u.Id, (h, u) => h)
                .AnyAsync(h => h.LoginTime >= recentLoginCutoff && h.Status == "Success", ct);

            if (recentAdminActivity)
            {
                _logger.LogInformation("Admin activity detected within last 15 minutes. Skipping email digest.");
                return; // An admin is active — they'll see the notifications in the UI
            }

            // 3. Compose and dispatch email digest
            var adminEmail = configuration["SendGrid:AdminEmail"] ?? "admin@legalconnect.com";
            var subject = $"🚨 LegalConnect: {unreadCriticals.Count} Unacknowledged Critical Alert(s)";

            var alertList = string.Join("\n", unreadCriticals.Select((n, i) =>
                $"  {i + 1}. [{n.Severity.ToUpper()}] {n.Title}\n     {n.Message}\n     Created: {n.CreatedAt:yyyy-MM-dd HH:mm} UTC"
            ));

            var plainBody = $@"LegalConnect Admin Alert Digest
================================

{unreadCriticals.Count} critical notification(s) have been waiting for admin acknowledgement for {StalenessThreshold.TotalMinutes}+ minutes.

{alertList}

---
Please log in to the Admin Dashboard to review and take action:
{configuration["AdminAppUrl"] ?? "http://localhost:4201"}/notifications

This is an automated digest from LegalConnect AdminNotificationDigestService.";

            var htmlAlerts = string.Join("", unreadCriticals.Select(n =>
                $@"<tr>
                    <td style='padding:8px 12px; border-bottom:1px solid #334155; color:#f43f5e; font-weight:bold; font-size:12px;'>{n.Severity.ToUpper()}</td>
                    <td style='padding:8px 12px; border-bottom:1px solid #334155; color:#e2e8f0; font-size:13px;'>{n.Title}</td>
                    <td style='padding:8px 12px; border-bottom:1px solid #334155; color:#94a3b8; font-size:12px;'>{n.CreatedAt:MMM dd, HH:mm} UTC</td>
                </tr>"
            ));

            var htmlBody = $@"
<div style='font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden;'>
    <div style='background: linear-gradient(135deg, #1e1b4b, #312e81); padding: 24px; text-align: center;'>
        <h1 style='color: #e0e7ff; font-size: 20px; margin: 0;'>🚨 Admin Alert Digest</h1>
        <p style='color: #a5b4fc; font-size: 13px; margin: 8px 0 0;'>{unreadCriticals.Count} unacknowledged critical alert(s)</p>
    </div>
    <div style='padding: 20px;'>
        <table style='width: 100%; border-collapse: collapse;'>
            <thead>
                <tr>
                    <th style='padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #1e293b;'>Severity</th>
                    <th style='padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #1e293b;'>Alert</th>
                    <th style='padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #1e293b;'>Time</th>
                </tr>
            </thead>
            <tbody>
                {htmlAlerts}
            </tbody>
        </table>
        <div style='margin-top: 24px; text-align: center;'>
            <a href='{configuration["AdminAppUrl"] ?? "http://localhost:4201"}/notifications' style='display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px;'>
                Open Admin Dashboard →
            </a>
        </div>
    </div>
    <div style='padding: 16px; text-align: center; color: #475569; font-size: 11px; border-top: 1px solid #1e293b;'>
        Automated digest from LegalConnect AdminNotificationDigestService
    </div>
</div>";

            try
            {
                await emailService.SendContactNotificationAsync(
                    "LegalConnect System",
                    adminEmail,
                    subject,
                    plainBody
                );
                _logger.LogInformation("📧 Email digest dispatched with {Count} critical alerts to {Email}", unreadCriticals.Count, adminEmail);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to dispatch email digest.");
            }
        }
    }
}