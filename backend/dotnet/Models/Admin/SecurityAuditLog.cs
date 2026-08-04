using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CoreApi.Models.Admin
{
    public class SecurityAuditLog
    {
        [Key]
        public int Id { get; set; }

        /// <summary>User who triggered the security event (null for system-level events).</summary>
        public int? UserId { get; set; }

        /// <summary>Event type: "failed_login", "failed_login_burst", "role_change", "2fa_disabled", "bulk_export", "account_locked", "password_reset".</summary>
        [Required]
        [MaxLength(50)]
        public string EventType { get; set; } = string.Empty;

        /// <summary>Priority level: "critical", "warning", "info".</summary>
        [Required]
        [MaxLength(20)]
        public string Severity { get; set; } = "info";

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? IpAddress { get; set; }

        [MaxLength(500)]
        public string? UserAgent { get; set; }

        /// <summary>JSON blob for extra context (e.g. old role, new role, affected user ID).</summary>
        public string? Metadata { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [JsonIgnore]
        public User? User { get; set; }
    }
}