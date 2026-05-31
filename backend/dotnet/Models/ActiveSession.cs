using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CoreApi.Models
{
    public class ActiveSession
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        [Required]
        [MaxLength(250)]
        public string TokenId { get; set; } = string.Empty;

        [MaxLength(250)]
        public string UserAgent { get; set; } = "Unknown Device";

        [MaxLength(50)]
        public string IpAddress { get; set; } = "Unknown IP";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime LastActive { get; set; } = DateTime.UtcNow;

        [JsonIgnore]
        public User? User { get; set; }
    }
}
