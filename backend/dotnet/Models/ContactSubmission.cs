using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
{
    public class ContactSubmission
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string Subject { get; set; } = string.Empty;

        [Required]
        [MaxLength(4000)]
        public string Message { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Status { get; set; } = "New"; // New, Read, In Progress, Escalated to DPO, Resolved, Archived

        [MaxLength(20)]
        public string Priority { get; set; } = "Normal"; // Urgent, High, Normal, Low

        [MaxLength(50)]
        public string Category { get; set; } = "General"; // General, Lawyer Verification, Billing, Technical Bug, DPDP Grievance

        [MaxLength(100)]
        public string? AssignedAgent { get; set; }

        public DateTime? SlaDueDate { get; set; }

        [MaxLength(4000)]
        public string? InternalNotesJson { get; set; }

        [MaxLength(2000)]
        public string? ResolutionNote { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(45)]
        public string? IpAddress { get; set; }
    }
}