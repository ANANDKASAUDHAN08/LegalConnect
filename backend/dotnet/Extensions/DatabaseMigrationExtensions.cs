using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using CoreApi.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CoreApi.Extensions
{
    /// <summary>
    /// Production-grade database migration and initialization engine.
    /// Reconciles EF migrations, applies pending updates with retry resilience, and seeds base data.
    /// </summary>
    public static class DatabaseMigrationExtensions
    {
        public static async Task InitializeAndMigrateDatabaseAsync(this WebApplication app)
        {
            var autoMigrate = app.Configuration.GetValue("Database:AutoMigrate", true);
            if (!autoMigrate && !app.Environment.IsDevelopment())
            {
                return;
            }

            using var scope = app.Services.CreateScope();
            var services = scope.ServiceProvider;
            var logger = services.GetRequiredService<ILogger<AppDbContext>>();

            const int maxRetries = 3;
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    var db = services.GetRequiredService<AppDbContext>();

                    // 1. Reconcile EF migration history with existing schema (idempotent)
                    try
                    {
                        DbSeeder.SynchronizeEFMigrationsHistory(db);
                    }
                    catch (Exception ex)
                    {
                        logger.LogDebug("EF Migration history sync: {Message}", ex.Message);
                    }

                    // 2. Query and apply pending EF Core migrations
                    var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).ToList();
                    if (pendingMigrations.Count > 0)
                    {
                        logger.LogInformation(
                            "🔄 [Database Migration] Found {Count} pending migration(s): {Migrations}. Applying updates...",
                            pendingMigrations.Count,
                            string.Join(", ", pendingMigrations)
                        );

                        var stopwatch = Stopwatch.StartNew();
                        await db.Database.MigrateAsync();
                        stopwatch.Stop();

                        logger.LogInformation(
                            "✅ [Database Migration] Schema successfully synchronized in {ElapsedMs}ms.",
                            stopwatch.ElapsedMilliseconds
                        );
                    }
                    else
                    {
                        logger.LogDebug("⚡ [Database Migration] Schema is fully up-to-date. Zero migrations required.");
                    }

                    // 3. Seed baseline database content (users, admin, reference datasets)
                    try
                    {
                        DbSeeder.Seed(db, app.Configuration);
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "⚠️ [Database Seeding] Non-fatal issue during baseline seeding: {Message}", ex.Message);
                    }

                    break; // Migration & initialization completed successfully
                }
                catch (Exception ex) when (attempt < maxRetries)
                {
                    logger.LogWarning(
                        ex,
                        "⚠️ [Database Migration] Attempt {Attempt}/{MaxRetries} failed. Retrying in 2 seconds (database warming up)...",
                        attempt,
                        maxRetries
                    );
                    await Task.Delay(2000);
                }
                catch (Exception ex)
                {
                    logger.LogError(
                        ex,
                        "❌ [Database Migration] Critical error applying database migrations after {MaxRetries} attempts.",
                        maxRetries
                    );
                    if (!app.Environment.IsDevelopment())
                    {
                        throw; // In production, fail-fast if DB schema cannot be verified
                    }
                }
            }
        }
    }
}