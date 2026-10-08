using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.DTOs
{
    /// <summary>
    /// Data Transfer Object for cross-service user notification ingestion.
    /// Designed for forward compatibility: new optional fields can be added
    /// without breaking existing callers (Open/Closed Principle).
    /// </summary>
    public class UserNotificationIngestDto
    {
        /// <summary>Notification category used for routing, filtering, and preference checks.</summary>
        [Required]
        [RegularExpression("^(system|legal|case|lawyer|review|profile|security|verification|hearing|document|payment)$",
            ErrorMessage = "Invalid notification type.")]
        public string Type { get; set; } = "system";

        /// <summary>Short headline displayed in the notification card (max 200 chars).</summary>
        [Required]
        [StringLength(200, MinimumLength = 3, ErrorMessage = "Title must be 3–200 characters.")]
        public string Title { get; set; } = string.Empty;

        /// <summary>Brief description shown below the title (max 500 chars).</summary>
        [Required]
        [StringLength(500, MinimumLength = 5, ErrorMessage = "Summary must be 5–500 characters.")]
        public string Summary { get; set; } = string.Empty;

        /// <summary>Optional expandable long-form context (case details, statute text, etc.).</summary>
        [StringLength(2000)]
        public string? Details { get; set; }

        /// <summary>Lucide/Feather icon name for the notification badge.</summary>
        public string Icon { get; set; } = "bell";

        /// <summary>Deep link URL for the notification's primary call-to-action.</summary>
        public string ActionUrl { get; set; } = string.Empty;

        /// <summary>Label for the action button (e.g. "View Consultation Docket").</summary>
        public string ActionLabel { get; set; } = "View Details";

        /// <summary>Alert severity level controlling visual treatment and push behavior.</summary>
        [RegularExpression("^(low|normal|high|urgent)$", ErrorMessage = "Priority must be low, normal, high, or urgent.")]
        public string Priority { get; set; } = "normal";

        /// <summary>Originating subsystem identifier for audit trails (e.g. "BCI Verification Engine").</summary>
        public string Source { get; set; } = "System";

        /// <summary>
        /// Idempotency key: prevents duplicate notifications for the same domain event.
        /// Format convention: "dotnet-{entity}-{id}-{action}" (e.g. "dotnet-consult-42-lawyer").
        /// </summary>
        public string? ExternalId { get; set; }

        /// <summary>Target user ID for directed notifications. Null = broadcast to all users.</summary>
        public string? RecipientUserId { get; set; }

        /// <summary>Arbitrary key-value pairs rendered as metadata chips in the notification UI.</summary>
        public Dictionary<string, object>? Metadata { get; set; }

        /// <summary>
        /// UTC timestamp of when the domain event occurred. Defaults to now.
        /// Used for event sourcing, audit trails, and chronological ordering.
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Result envelope for notification push operations.
    /// Enables callers to observe success/failure without try-catch coupling.
    /// </summary>
    public class NotificationPushResult
    {
        public bool Success { get; set; }
        public string? NotificationId { get; set; }
        public string? ErrorMessage { get; set; }

        public static NotificationPushResult Ok(string? notifId = null) =>
            new() { Success = true, NotificationId = notifId };

        public static NotificationPushResult Fail(string error) =>
            new() { Success = false, ErrorMessage = error };
    }
}