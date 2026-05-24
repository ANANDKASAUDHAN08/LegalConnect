using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoreApi.Models
{
    public class Consultation
    {
        [Key]
        public int Id { get; set; }

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

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
