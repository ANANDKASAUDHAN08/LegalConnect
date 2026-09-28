using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoreApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    /// <summary>
    /// Background service that periodically cleans up expired and revoked refresh tokens
    /// from the database to prevent unbounded table growth over time.
    ///
    /// Runs once every 24 hours. Processes tokens in batches of 1000 to avoid long-running
    /// database locks on the RefreshTokens table.
    ///
    /// Cleanup criteria: tokens that are either expired or revoked for more than 7 days.
    /// </summary>
    public class TokenCleanupWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TokenCleanupWorker> _logger;

        public TokenCleanupWorker(IServiceProvider serviceProvider, ILogger<TokenCleanupWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("TokenCleanupWorker: Background token cleanup task started.");

            // Wait 30 seconds on startup to let the database and other services boot up
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupExpiredTokensAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "TokenCleanupWorker: Error during token cleanup.");
                }

                // Run once every 24 hours
                try
                {
                    await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }

            _logger.LogInformation("TokenCleanupWorker: Background token cleanup task stopping.");
        }

        private async Task CleanupExpiredTokensAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Delete tokens that are expired or revoked for more than 7 days
            var cutoff = DateTime.UtcNow.AddDays(-7);

            try
            {
                // Direct database deletion — bypasses ChangeTracker, eliminates memory bloat
                var totalRemoved = await context.RefreshTokens
                    .Where(r => r.ExpiresAt < cutoff || (r.RevokedAt != null && r.RevokedAt < cutoff))
                    .ExecuteDeleteAsync(stoppingToken);

                if (totalRemoved > 0)
                {
                    _logger.LogInformation("TokenCleanupWorker: Cleaned up {Count} expired/revoked refresh tokens.", totalRemoved);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TokenCleanupWorker: Error during bulk token deletion.");
            }
        }
    }
}