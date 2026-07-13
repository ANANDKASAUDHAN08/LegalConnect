using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CoreApi.Models
{
    public class RefreshToken
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(256)]
        public string Token { get; set; } = string.Empty;

        public int UserId { get; set; }

        [Required]
        [MaxLength(250)]
        public string SessionId { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public DateTime? RevokedAt { get; set; }

        [MaxLength(256)]
        public string? ReplacedByToken { get; set; }

        [MaxLength(50)]
        public string? RevokedByIp { get; set; }

        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
        public bool IsRevoked => RevokedAt != null;
        public bool IsActive => !IsRevoked && !IsExpired;

        [JsonIgnore]
        public User? User { get; set; }
    }
}
