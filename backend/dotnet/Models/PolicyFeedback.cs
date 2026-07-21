using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
{
    public class PolicyFeedback
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string PageSlug { get; set; } = string.Empty;

        [Required]
        public bool IsHelpful { get; set; }

        [MaxLength(45)]
        public string? IpAddress { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? UserId { get; set; }
        
        public User? User { get; set; }
    }
}