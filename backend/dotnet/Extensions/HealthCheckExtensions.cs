using System;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CoreApi.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace CoreApi.Extensions
{
    /// <summary>
    /// Custom EF Core Database Probe.
    /// Executes a low-overhead connection check to verify active MySQL connectivity.
    /// </summary>
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public DatabaseHealthCheck(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
                return canConnect
                    ? HealthCheckResult.Healthy("MySQL Database connection is responsive.")
                    : HealthCheckResult.Unhealthy("Unable to establish connection to MySQL Database.");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy($"Database connectivity failure: {ex.Message}", ex);
            }
        }
    }

    /// <summary>
    /// Enterprise Health Check Engine.
    /// Provides deep health probes compatible with Kubernetes liveness/readiness probes and cloud load balancers.
    /// </summary>
    public static class HealthCheckExtensions
    {
        private static readonly DateTime ProcessStartTime = DateTime.UtcNow;

        public static IServiceCollection AddAppHealthChecks(this IServiceCollection services)
        {
            services.AddHealthChecks()
                .AddCheck<DatabaseHealthCheck>("mysql_database", tags: new[] { "ready", "db" });

            return services;
        }

        public static void MapAppHealthChecks(this WebApplication app)
        {
            app.MapHealthChecks("/api/health", new HealthCheckOptions
            {
                ResponseWriter = async (context, report) =>
                {
                    context.Response.ContentType = "application/json";

                    var totalUptime = DateTime.UtcNow - ProcessStartTime;

                    var response = new
                    {
                        status = report.Status.ToString(),
                        timestamp = DateTime.UtcNow,
                        uptime = $"{totalUptime.Days}d {totalUptime.Hours}h {totalUptime.Minutes}m {totalUptime.Seconds}s",
                        uptimeSeconds = Math.Round(totalUptime.TotalSeconds, 1),
                        totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 2),
                        entries = report.Entries.Select(e => new
                        {
                            component = e.Key,
                            status = e.Value.Status.ToString(),
                            description = e.Value.Description,
                            durationMs = Math.Round(e.Value.Duration.TotalMilliseconds, 2)
                        })
                    };

                    await JsonSerializer.SerializeAsync(context.Response.Body, response, new JsonSerializerOptions
                    {
                        WriteIndented = false
                    });
                }
            });
        }
    }
}