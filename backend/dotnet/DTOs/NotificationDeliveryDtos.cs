using System;
using System.Collections.Generic;

namespace CoreApi.DTOs
{
    /// <summary>
    /// Quiet Hours (Do-Not-Disturb) window forwarded from the Node.js preference store.
    /// Times are "HH:mm" in the recipient's <c>PreferredTimezone</c>.
    /// </summary>
    public class QuietHoursWindowDto
    {
        public bool Enabled { get; set; }
        public string StartTime { get; set; } = "22:00";
        public string EndTime { get; set; } = "07:30";
        public bool AllowUrgent { get; set; } = true;
    }

    /// <summary>
    /// Internal request (Node.js → .NET) to fan a notification out to external channels
    /// that the recipient has enabled for this category.
    /// </summary>
    public class NotificationDispatchRequestDto
    {
        public string RecipientUserId { get; set; } = string.Empty;
        public string? NotificationId { get; set; }
        public string Type { get; set; } = "system";
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? Details { get; set; }
        public string? ActionUrl { get; set; }
        public string? ActionLabel { get; set; }
        public string Priority { get; set; } = "normal";
        public bool Email { get; set; }
        public bool WhatsApp { get; set; }
        public QuietHoursWindowDto? QuietHours { get; set; }
    }

    /// <summary>Per-channel delivery outcome.</summary>
    public class ChannelDeliveryResultDto
    {
        public string Channel { get; set; } = string.Empty;           // "email" | "whatsapp"
        public string Status { get; set; } = "skipped";                // "sent" | "simulated" | "skipped" | "failed"
        public string? Provider { get; set; }
        public string? Target { get; set; }                            // masked address / phone
        public string? Reason { get; set; }
        public string? DirectUrl { get; set; }
        public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
    }

    public class NotificationDispatchResultDto
    {
        public bool QuietHoursActive { get; set; }
        public List<ChannelDeliveryResultDto> Results { get; set; } = new();
    }

    public class NotificationTestDeliveryRequestDto
    {
        public string Channel { get; set; } = "email";
    }

    /// <summary>Destination + provider readiness shown on the preferences page.</summary>
    public class NotificationDeliveryStatusDto
    {
        public string? EmailAddress { get; set; }
        public bool EmailVerified { get; set; }
        public string EmailProvider { get; set; } = "Console";
        public bool EmailProviderLive { get; set; }

        public string? WhatsAppPhone { get; set; }
        public string WhatsAppProvider { get; set; } = "LegalConnect Direct Gateway";
        public bool WhatsAppProviderLive { get; set; }

        public string? Timezone { get; set; }
    }

    /// <summary>Outcome of a single email send.</summary>
    public class EmailSendResultDto
    {
        public bool IsSuccess { get; set; }
        public bool IsSimulated { get; set; }
        public string Provider { get; set; } = string.Empty;
        public string TargetEmail { get; set; } = string.Empty;
        public string? ErrorDetails { get; set; }
    }
}