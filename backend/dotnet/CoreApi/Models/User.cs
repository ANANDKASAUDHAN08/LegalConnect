using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CoreApi.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "Citizen"; // Citizen or Lawyer

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Security & Verification Fields
        public bool IsEmailVerified { get; set; } = false;
        
        [MaxLength(200)]
        public string? EmailVerificationToken { get; set; }

        [MaxLength(200)]
        public string? PasswordResetToken { get; set; }

        public DateTime? PasswordResetTokenExpires { get; set; }

        [MaxLength(100)]
        public string? GoogleId { get; set; }

        // Navigation property for LawyerProfile (One-to-One)
        [JsonIgnore]
        public LawyerProfile? LawyerProfile { get; set; }
    }
}
