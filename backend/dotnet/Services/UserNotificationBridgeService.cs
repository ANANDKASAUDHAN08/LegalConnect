using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CoreApi.DTOs;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    /// <summary>
    /// Production implementation of the cross-service notification bridge.
    /// Serializes domain events from .NET controllers and POSTs them to the
    /// Node.js notification ingest endpoint for real-time SSE broadcast.
    ///
    /// Resilience patterns:
    /// - CancellationToken propagation for graceful shutdown
    /// - Structured error capture via NotificationPushResult (non-throwing)
    /// - Idempotency via ExternalId (Node.js deduplicates on ingest)
    /// - Batch fan-out with per-recipient result tracking
    /// </summary>
    public class UserNotificationBridgeService : IUserNotificationBridgeService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<UserNotificationBridgeService> _logger;
        private readonly string _nodeBaseUrl;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        public UserNotificationBridgeService(
            IHttpClientFactory httpClientFactory,
            ILogger<UserNotificationBridgeService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _nodeBaseUrl = Environment.GetEnvironmentVariable("NODE_API_URL") ?? "http://localhost:5000";
        }

        /// <inheritdoc />
        public async Task<NotificationPushResult> PushNotificationAsync(
            UserNotificationIngestDto dto,
            CancellationToken cancellationToken = default)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Summary))
            {
                return NotificationPushResult.Fail("DTO is null or missing required Title/Summary fields.");
            }

            try
            {
                var client = _httpClientFactory.CreateClient("NodeSync");

                var payload = new
                {
                    type = dto.Type,
                    title = dto.Title,
                    summary = dto.Summary,
                    details = dto.Details ?? string.Empty,
                    icon = dto.Icon,
                    actionUrl = dto.ActionUrl,
                    actionLabel = dto.ActionLabel,
                    priority = dto.Priority,
                    source = dto.Source,
                    externalId = dto.ExternalId,
                    recipientUserId = dto.RecipientUserId,
                    metadata = dto.Metadata ?? new Dictionary<string, object>(),
                    createdAt = dto.CreatedAt.ToString("o") // ISO 8601 for cross-service consistency
                };

                var json = JsonSerializer.Serialize(payload, _jsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await client.PostAsync(
                    $"{_nodeBaseUrl}/api/info/notifications/ingest",
                    content,
                    cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var errBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogWarning(
                        "UserNotificationBridge: Ingest returned {StatusCode} for '{Title}' ({Type}): {Error}",
                        response.StatusCode, dto.Title, dto.Type, errBody);
                    return NotificationPushResult.Fail($"HTTP {(int)response.StatusCode}: {errBody}");
                }

                // Extract notification ID from response if available
                string? notifId = null;
                try
                {
                    var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    using var doc = JsonDocument.Parse(responseBody);
                    if (doc.RootElement.TryGetProperty("notificationId", out var idProp))
                    {
                        notifId = idProp.GetString();
                    }
                }
                catch { /* Response parsing is best-effort */ }

                _logger.LogInformation(
                    "UserNotificationBridge: Pushed '{Title}' ({Type}, {Priority}) → {Recipient}",
                    dto.Title, dto.Type, dto.Priority, dto.RecipientUserId ?? "broadcast");

                return NotificationPushResult.Ok(notifId);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation("UserNotificationBridge: Push cancelled for '{Title}' (shutdown).", dto.Title);
                return NotificationPushResult.Fail("Operation cancelled (graceful shutdown).");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "UserNotificationBridge: Failed to push '{Title}' to Node feed (service may be initializing).",
                    dto.Title);
                return NotificationPushResult.Fail(ex.Message);
            }
        }

        /// <inheritdoc />
        public async Task<IReadOnlyList<NotificationPushResult>> PushBulkAsync(
            UserNotificationIngestDto template,
            IEnumerable<string> recipientUserIds,
            CancellationToken cancellationToken = default)
        {
            if (template == null || recipientUserIds == null)
            {
                return new[] { NotificationPushResult.Fail("Template or recipient list is null.") };
            }

            var recipients = recipientUserIds.Where(id => !string.IsNullOrWhiteSpace(id)).ToList();
            if (recipients.Count == 0)
            {
                return new[] { NotificationPushResult.Fail("No valid recipient IDs provided.") };
            }

            var results = new List<NotificationPushResult>(recipients.Count);

            // Fan out with concurrency control (max 5 parallel to avoid overwhelming Node.js)
            var semaphore = new SemaphoreSlim(5);
            var tasks = recipients.Select(async recipientId =>
            {
                await semaphore.WaitAsync(cancellationToken);
                try
                {
                    var dto = new UserNotificationIngestDto
                    {
                        Type = template.Type,
                        Title = template.Title,
                        Summary = template.Summary,
                        Details = template.Details,
                        Icon = template.Icon,
                        ActionUrl = template.ActionUrl,
                        ActionLabel = template.ActionLabel,
                        Priority = template.Priority,
                        Source = template.Source,
                        ExternalId = template.ExternalId != null
                            ? $"{template.ExternalId}-{recipientId}"
                            : null,
                        RecipientUserId = recipientId,
                        Metadata = template.Metadata,
                        CreatedAt = template.CreatedAt
                    };
                    return await PushNotificationAsync(dto, cancellationToken);
                }
                finally
                {
                    semaphore.Release();
                }
            });

            var completedResults = await Task.WhenAll(tasks);
            results.AddRange(completedResults);

            _logger.LogInformation(
                "UserNotificationBridge: Bulk push complete — {Success}/{Total} succeeded for '{Title}'.",
                results.Count(r => r.Success), results.Count, template.Title);

            return results;
        }
    }
}