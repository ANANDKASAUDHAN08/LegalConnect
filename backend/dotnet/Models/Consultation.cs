using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoreApi.Models
{
    public class Consultation
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Enterprise non-sequential public identifier exposed in APIs and client displays (e.g. inq_10ad45b1c74e89f2).
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string PublicId { get; set; } = CoreApi.Extensions.PublicIdGenerator.Generate("inq");

        public int? ClientId { get; set; }
        
        [ForeignKey("ClientId")]
        public User? Client { get; set; }

        [Required]
        [MaxLength(100)]
        public string ClientName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string ClientEmail { get; set; } = string.Empty;

        [Required]
        public int LawyerId { get; set; }

        [ForeignKey("LawyerId")]
        public User? Lawyer { get; set; }

        [Required]
        public string Message { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Contacted, Closed

        public string? AdminRemark { get; set; }

        public string? AuditLogJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}