using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
{
    public class ProfileView
    {
        [Key]
        public int Id { get; set; }

        public int LawyerId { get; set; }

        public int? ViewerUserId { get; set; }

        [MaxLength(45)]
        public string? IpAddress { get; set; }

        [MaxLength(500)]
        public string? UserAgent { get; set; }

        public DateTime ViewedAt { get; set; } = DateTime.UtcNow;
    }
}