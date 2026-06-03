using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    public class ProfileSyncWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ProfileSyncWorker> _logger;

        public ProfileSyncWorker(IServiceProvider serviceProvider, ILogger<ProfileSyncWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ProfileSyncWorker: Background scheduled sync task started.");

            // Wait 10 seconds on startup before running the first sync to let other services boot up
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("ProfileSyncWorker: Starting automatic database reconciliation...");
                    
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var syncService = scope.ServiceProvider.GetRequiredService<ILawyerSyncService>();
                        await syncService.SyncAllProfilesToMongoAsync();
                    }

                    _logger.LogInformation("ProfileSyncWorker: Automatic database reconciliation finished successfully.");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"ProfileSyncWorker: Error during automatic database reconciliation: {ex.Message}");
                }

                // Wait 12 hours before next run
                try
                {
                    await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }

            _logger.LogInformation("ProfileSyncWorker: Background scheduled sync task stopping.");
        }
    }
}
