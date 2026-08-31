using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Models
{
    /// <summary>
    /// Polymorphic Trust & Safety report entity.
    /// Supports reports from both authenticated users and anonymous citizens.
    /// Indexed for admin queue triage by severity, status, and creation date.
    /// </summary>
    public enum ReportSeverity
    {
        Low = 1,       // Typo, minor formatting
        Medium = 2,    // Inaccurate phone, wrong address, stale timing
        High = 3,      // Fake profile, abusive language, bribery allegation
        Critical = 4   // PII breach, fraud, illegal activity
    }

    public enum ReportStatus
    {
        Pending = 1,
        Investigating = 2,
        Resolved = 3,
        Dismissed = 4,
        Duplicate = 5
    }

    [Index(nameof(TargetType), nameof(TargetId))]
    [Index(nameof(Status), nameof(Severity))]
    [Index(nameof(CreatedAt))]
    public class ContentReport
    {
        [Key]
        public long Id { get; set; }

        /// <summary>
        /// Nullable — anonymous/guest reports set this to null.
        /// </summary>
        public int? ReporterUserId { get; set; }

        [ForeignKey("ReporterUserId")]
        public User? ReporterUser { get; set; }

        [MaxLength(100)]
        public string ReporterEmail { get; set; } = string.Empty;

        [MaxLength(50)]
        public string ReporterName { get; set; } = "Citizen";

        /// <summary>
        /// The entity type: "Review", "LegalResource", "Lawyer", "BareActSection", "Template", "Helpline"
        /// </summary>
        [Required]
        [MaxLength(40)]
        public string TargetType { get; set; } = string.Empty;

        /// <summary>
        /// Supports both stringified SQL int IDs and MongoDB ObjectId strings.
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string TargetId { get; set; } = string.Empty;

        /// <summary>
        /// Cached display name of the target entity for quick admin triage.
        /// </summary>
        [Required]
        [MaxLength(200)]
        public string TargetTitle { get; set; } = string.Empty;

        /// <summary>
        /// Structured reason taxonomy, context-aware per TargetType.
        /// Review:         "SPAM", "ABUSIVE_LANGUAGE", "PII_LEAK", "FAKE_REVIEW", "IRRELEVANT"
        /// LegalResource:  "CLOSED_PERMANENTLY", "WRONG_ADDRESS", "WRONG_PHONE", "BRIBERY_ALLEGATION", "FACILITIES_CHANGED"
        /// Lawyer:         "FAKE_REGISTRATION", "NOT_PRACTICING", "MISCONDUCT", "WRONG_SPECIALIZATION"
        /// BareActSection: "INCORRECT_TEXT", "OUTDATED_AMENDMENT", "WRONG_SECTION_NUMBER"
        /// </summary>
        [Required]
        [MaxLength(80)]
        public string ReasonCategory { get; set; } = string.Empty;

        [Required]
        [MaxLength(2000)]
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// URL to uploaded evidence (photo, document proof or data URL).
        /// </summary>
        [Column(TypeName = "longtext")]
        public string? EvidenceUrl { get; set; }

        public ReportSeverity Severity { get; set; } = ReportSeverity.Medium;

        public ReportStatus Status { get; set; } = ReportStatus.Pending;

        /// <summary>
        /// Count of duplicate reports merged into this one.
        /// Used for anti-brigading grouping and surfacing popular reports.
        /// </summary>
        public int DuplicateCount { get; set; } = 0;

        [MaxLength(2000)]
        public string? AdminResolutionNotes { get; set; }

        [MaxLength(100)]
        public string? ResolvedByAdminEmail { get; set; }

        public DateTime? ResolvedAt { get; set; }

        [MaxLength(45)]
        public string? ClientIp { get; set; }

        /// <summary>
        /// Browser fingerprint hash for anti-brigading detection.
        /// </summary>
        [MaxLength(200)]
        public string? ClientFingerprint { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}