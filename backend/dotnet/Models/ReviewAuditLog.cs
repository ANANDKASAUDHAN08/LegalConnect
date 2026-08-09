using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
{
    public class ReviewAuditLog
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ReviewId { get; set; }

        public int? AdminId { get; set; }

        [MaxLength(150)]
        public string AdminEmail { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Action { get; set; } = string.Empty; // Approved, Hidden, Flagged, Redacted, DisputeResolved

        [MaxLength(30)]
        public string? PreviousStatus { get; set; }

        [MaxLength(30)]
        public string? NewStatus { get; set; }

        [MaxLength(50)]
        public string? ReasonCode { get; set; } // POLICY-101, POLICY-102, etc.

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}