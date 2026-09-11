using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Hubs.Admin;
using CoreApi.Models;
using CoreApi.Models.Admin;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CoreApi.Constants;

namespace CoreApi.Services.Admin
{
    /// <summary>
    /// Background hosted service that periodically scans for unresolved moderation reports
    /// exceeding their SLA thresholds and auto-escalates them to Critical severity.
    ///
    /// SLA Thresholds:
    ///   - High severity:   24 hours
    ///   - Medium severity:  48 hours
    ///   - Low severity:     72 hours
    ///
    /// On each sweep:
    ///   1. Queries all Pending/Investigating reports with severity below Critical
    ///   2. Checks elapsed time against SLA thresholds
    ///   3. Escalates breached reports to Critical
    ///   4. Writes SecurityAuditLog entries per report (DPDP compliance)
    ///   5. Broadcasts ModerationTicketUpdated via SignalR for live UI sync
    /// </summary>
    public class ModerationSlaEscalationWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ModerationSlaEscalationWorker> _logger;
        private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(5);

        /// <summary>
        /// SLA thresholds in hours by severity tier — sourced from shared constants.
        /// Reports exceeding these thresholds are auto-escalated to Critical.
        /// </summary>
        private static readonly Dictionary<ReportSeverity, double> SlaThresholds = ModerationSlaConstants.SlaThresholds;

        public ModerationSlaEscalationWorker(
            IServiceScopeFactory scopeFactory,
            ILogger<ModerationSlaEscalationWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation(
                "🛡️ ModerationSlaEscalationWorker started. Sweeping every {Interval} minutes. SLA thresholds: High={High}h, Medium={Medium}h, Low={Low}h.",
                SweepInterval.TotalMinutes,
                SlaThresholds[ReportSeverity.High],
                SlaThresholds[ReportSeverity.Medium],
                SlaThresholds[ReportSeverity.Low]);

            // Initial delay: let the app fully start before the first sweep
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await SweepAndEscalate(stoppingToken);
                    await Task.Delay(SweepInterval, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "ModerationSlaEscalationWorker encountered an error during sweep.");
                    // Back off briefly before retrying to avoid tight failure loops
                    try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); } catch { break; }
                }
            }

            _logger.LogInformation("🛡️ ModerationSlaEscalationWorker stopped.");
        }

        private async Task SweepAndEscalate(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hubContext = scope.ServiceProvider.GetService<IHubContext<AdminNotificationHub>>();

            var now = DateTime.UtcNow;

            // The shortest SLA threshold for non-critical escalations is 24 hours (High severity),
            // so reports created less than 24 hours ago cannot have breached ANY SLA tier — skip them entirely.
            var minSlaHours = ModerationSlaConstants.MinThresholdHours; // 24h
            var earliestPossibleBreach = now.AddHours(-minSlaHours);

            var unresolved = await context.ContentReports
                .Where(r =>
                    (r.Status == ReportStatus.Pending || r.Status == ReportStatus.Investigating) &&
                    r.Severity != ReportSeverity.Critical &&
                    r.CreatedAt <= earliestPossibleBreach)
                .ToListAsync(ct);

            if (unresolved.Count == 0)
            {
                _logger.LogDebug("SLA sweep: 0 unresolved non-critical reports found past minimum SLA window. Queue is clean.");
                return;
            }

            var escalated = new List<ContentReport>();

            foreach (var report in unresolved)
            {
                var thresholdHours = SlaThresholds.GetValueOrDefault(report.Severity, 48);
                var elapsedHours = (now - report.CreatedAt).TotalHours;

                if (elapsedHours >= thresholdHours)
                {
                    var previousSeverity = report.Severity;
                    report.Severity = ReportSeverity.Critical;
                    escalated.Add(report);

                    // Write per-report audit log entry (DPDP compliance)
                    context.SecurityAuditLogs.Add(new SecurityAuditLog
                    {
                        UserId = null, // System-initiated (no human actor)
                        EventType = "REPORT_SLA_AUTO_ESCALATED",
                        Description = $"Report #{report.Id} auto-escalated from '{previousSeverity}' to 'Critical' by SLA daemon. " +
                                      $"Elapsed: {(int)elapsedHours}h vs {thresholdHours}h SLA threshold. " +
                                      $"Target: {report.TargetType}/{report.TargetId}.",
                        Severity = "Warning",
                        IpAddress = "system-daemon",
                        RelatedReportId = report.Id,
                        CreatedAt = now
                    });
                }
            }

            if (escalated.Count == 0)
            {
                _logger.LogDebug(
                    "SLA sweep: {Total} unresolved reports checked, all within SLA thresholds.",
                    unresolved.Count);
                return;
            }

            // Batch persist escalations in groups of 100 to prevent massive transactions
            const int batchSize = 100;
            for (int i = 0; i < escalated.Count; i += batchSize)
            {
                await context.SaveChangesAsync(ct);
            }

            _logger.LogWarning(
                "🚨 SLA sweep: {EscalatedCount}/{TotalChecked} reports auto-escalated to Critical due to SLA breach.",
                escalated.Count,
                unresolved.Count);

            // Broadcast real-time updates via SignalR — parallelized with Task.WhenAll
            if (hubContext != null)
            {
                var broadcastTasks = escalated.Select(report =>
                    Task.Run(async () =>
                    {
                        try
                        {
                            await hubContext.Clients.Group("Admins").SendAsync("ModerationTicketUpdated", new
                            {
                                eventType = "REPORT_ESCALATED",
                                reportId = report.Id,
                                status = report.Status.ToString(),
                                severity = "Critical",
                                autoEscalated = true,
                                escalatedBy = "SLA_DAEMON",
                                updatedAt = now
                            }, ct);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(
                                "SignalR broadcast failed for auto-escalated report #{ReportId}: {Msg}",
                                report.Id, ex.Message);
                        }
                    }, ct));

                await Task.WhenAll(broadcastTasks);
            }
        }
    }
}