using System;
using System.Collections.Generic;

namespace CoreApi.DTOs
{
    public class TwoFactorSetupResponseDto
    {
        public string Secret { get; set; } = string.Empty;
        public string QrCodeUrl { get; set; } = string.Empty;
        public string QrUri { get; set; } = string.Empty;
        public List<string> BackupCodes { get; set; } = new();
        public bool IsPendingReuse { get; set; }
        public bool IsReconfiguring { get; set; }
        public string? Message { get; set; }
    }

    public class SessionResponseDto
    {
        public int Id { get; set; }
        public string IpAddress { get; set; } = string.Empty;
        public string UserAgent { get; set; } = string.Empty;
        public string DeviceType { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime LastActive { get; set; }
        public bool IsCurrentSession { get; set; }
    }

    public class LoginHistoryResponseDto
    {
        public int Id { get; set; }
        public string IpAddress { get; set; } = string.Empty;
        public string UserAgent { get; set; } = string.Empty;
        public string DeviceType { get; set; } = string.Empty;
        public string Browser { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public DateTime LoginTime { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class BackupCodesResponseDto
    {
        public int Remaining { get; set; }
        public int Total { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<string>? BackupCodes { get; set; }
    }
}