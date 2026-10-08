using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoreApi.DTOs;

namespace CoreApi.Services
{
    /// <summary>
    /// Cross-service bridge for pushing real-time notifications from the .NET domain layer
    /// into the Node.js/MongoDB notification feed via HTTP ingest.
    ///
    /// Design principles (aligned with Stripe/GitHub/Slack patterns):
    /// - CancellationToken on every async method for graceful shutdown
    /// - Typed result return for structured error handling
    /// - Batch method for multi-recipient broadcasts (O(1) HTTP calls via server fan-out)
    /// </summary>
    public interface IUserNotificationBridgeService
    {
        /// <summary>
        /// Push a single notification to the user notification feed.
        /// Returns a typed result indicating success/failure (non-throwing).
        /// </summary>
        Task<NotificationPushResult> PushNotificationAsync(
            UserNotificationIngestDto dto,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Push the same notification to multiple recipients in a single operation.
        /// Used for system-wide broadcasts, batch verification results, etc.
        /// The implementation fans out server-side to avoid N HTTP round-trips.
        /// </summary>
        Task<IReadOnlyList<NotificationPushResult>> PushBulkAsync(
            UserNotificationIngestDto template,
            IEnumerable<string> recipientUserIds,
            CancellationToken cancellationToken = default);
    }
}