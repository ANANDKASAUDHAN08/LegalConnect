using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Models.Admin
{
    [Index(nameof(IsArchived), nameof(CreatedAt))]
    [Index(nameof(Severity), nameof(IsArchived))]
    [Index(nameof(Category), nameof(IsArchived))]
    [Index(nameof(TargetRole), nameof(IsArchived))]
    [Index(nameof(IsRead), nameof(IsArchived))]
    [Index(nameof(RelatedEntityType), nameof(RelatedEntityId))]
    public class AdminNotification
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Null means global feed visible to all admins.</summary>
        public int? RecipientUserId { get; set; }

        /// <summary>Role-based targeting: "SuperAdmin", "VerificationOfficer", "SupportDesk", "All".</summary>
        [Required]
        [MaxLength(50)]
        public string TargetRole { get; set; } = "All";

        /// <summary>Event type: "lawyer_reg", "verification_req", "urgent_ticket", "security_alert", "announcement", "consultation_alert".</summary>
        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = "announcement";

        /// <summary>Priority level: "critical", "warning", "info", "success".</summary>
        [Required]
        [MaxLength(20)]
        public string Severity { get; set; } = "info";

        /// <summary>Domain category: "security", "verification", "support", "consultation", "announcement".</summary>
        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = "announcement";

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(2000)]
        public string Message { get; set; } = string.Empty;

        /// <summary>Optional Markdown content for expanded detail view.</summary>
        public string? DetailsMarkdown { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; } = false;

        public bool IsStarred { get; set; } = false;

        public bool IsArchived { get; set; } = false;

        /// <summary>Deep link to the relevant admin page, e.g. "/lawyers/42".</summary>
        [MaxLength(500)]
        public string? ActionUrl { get; set; }

        /// <summary>Button label text, e.g. "Audit License", "Open Ticket".</summary>
        [MaxLength(100)]
        public string? ActionLabel { get; set; }

        /// <summary>Originating system source, e.g. "Lawyer Verification", "Support Desk".</summary>
        [MaxLength(100)]
        public string? Source { get; set; }

        /// <summary>Type of the related entity, e.g. "LawyerProfile", "ContactSubmission", "Consultation".</summary>
        [MaxLength(100)]
        public string? RelatedEntityType { get; set; }

        /// <summary>Primary key of the related entity for inline quick actions.</summary>
        public int? RelatedEntityId { get; set; }

        /// <summary>Timestamp when an admin first acknowledged/read this notification.</summary>
        public DateTime? ReadAt { get; set; }

        /// <summary>User ID of the admin who read this notification (audit trail).</summary>
        public int? ReadByUserId { get; set; }

        // Navigation
        [JsonIgnore]
        public User? RecipientUser { get; set; }
    }
}