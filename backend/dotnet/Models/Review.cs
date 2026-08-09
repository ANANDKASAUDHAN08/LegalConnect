using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
{
    public class Review
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(20)]
        public string UserRole { get; set; } = string.Empty; // Client, Lawyer, Guest

        [Required]
        [MaxLength(100)]
        public string AuthorName { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string TargetName { get; set; } = "Platform"; // Platform or Lawyer Name

        [Required]
        [Range(1, 5)]
        public int Rating { get; set; } // 1 to 5 stars

        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        public int? TargetId { get; set; }

        [MaxLength(50)]
        public string TargetType { get; set; } = "Platform"; // Platform, Lawyer

        [MaxLength(30)]
        public string ModerationStatus { get; set; } = "Approved"; // Approved, Pending, Flagged, Hidden

        [MaxLength(250)]
        public string? FlagReason { get; set; }

        [MaxLength(2000)]
        public string? AdvocateReply { get; set; }

        [MaxLength(30)]
        public string? AdvocateReplyStatus { get; set; } // Pending, Approved

        public bool IsVerifiedClient { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? UserId { get; set; }

        public int Likes { get; set; } = 0;

        public int? ConsultationId { get; set; }

        [MaxLength(50)]
        public string? IPAddress { get; set; }

        public int RiskScore { get; set; } = 0;

        [MaxLength(2000)]
        public string? RedactedContent { get; set; }

        public DateTime? LastEditedAt { get; set; }

        [MaxLength(2000)]
        public string? OriginalContent { get; set; }

        public bool IsDisputeRequested { get; set; } = false;

        [MaxLength(500)]
        public string? DisputeReason { get; set; }

        public DateTime? DisputeRequestedAt { get; set; }
    }
}