using System;

namespace CoreApi.DTOs
{
    public class SendWhatsAppTestRequestDto
    {
        public string? Phone { get; set; }
    }

    public class WhatsAppStatusResponseDto
    {
        public bool IsConfigured { get; set; }
        public string ActiveProvider { get; set; } = "Auto";
        public bool HasMetaCredentials { get; set; }
        public bool HasTwilioCredentials { get; set; }
        public bool HasBrevoCredentials { get; set; }
        public bool UserHasWhatsAppEnabled { get; set; }
        public string? UserWhatsAppPhone { get; set; }
    }

    public class WhatsAppSendResultDto
    {
        public bool IsSuccess { get; set; }
        public string Provider { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string TargetPhone { get; set; } = string.Empty;
        public string? DirectWhatsAppUrl { get; set; }
        public string? ExternalMessageId { get; set; }
        public string? ErrorDetails { get; set; }
        public bool IsSimulated { get; set; } = false;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}