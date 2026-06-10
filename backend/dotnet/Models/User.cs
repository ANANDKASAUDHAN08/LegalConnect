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
        public string Role { get; set; } = "Client"; // Client or Lawyer

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Security & Verification Fields
        public bool IsEmailVerified { get; set; } = false;
        
        [MaxLength(200)]
        public string? EmailVerificationToken { get; set; }

        [MaxLength(20)]
        public string? Phone { get; set; }

        public bool IsPhoneVerified { get; set; } = false;

        [Required]
        [MaxLength(50)]
        public string IdentityStatus { get; set; } = "Not Started";

        [MaxLength(500)]
        public string? IdentityDocumentUrl { get; set; }

        public bool IsTwoFactorEnabled { get; set; } = false;

        [MaxLength(100)]
        public string? TwoFactorSecret { get; set; }

        [MaxLength(30)]
        public string? ClientLanguage { get; set; } = "English";

        [MaxLength(100)]
        public string? ClientCity { get; set; }

        [MaxLength(200)]
        public string? ClientInterest { get; set; }

        public DateTime? DateOfBirth { get; set; }

        [MaxLength(50)]
        public string? Gender { get; set; }

        [MaxLength(200)]
        public string? AddressLine1 { get; set; }

        [MaxLength(100)]
        public string? ClientState { get; set; }

        [MaxLength(20)]
        public string? ClientZip { get; set; }

        [MaxLength(1000)]
        public string? ClientBio { get; set; }

        [MaxLength(500)]
        public string? AvatarUrl { get; set; }

        [MaxLength(200)]
        public string? PasswordResetToken { get; set; }

        public DateTime? PasswordResetTokenExpires { get; set; }

        [MaxLength(100)]
        public string? GoogleId { get; set; }

        // ── User Preference / Settings Fields ──────────────────────────────
        [MaxLength(80)]
        public string? PreferredTimezone { get; set; } = "Asia/Kolkata";

        [MaxLength(20)]
        public string? DateFormat { get; set; } = "DD/MM/YYYY";

        public bool NotifyLawAmendments { get; set; } = true;

        public bool NotifyEmailDigest { get; set; } = true;

        public bool NotifyPushEnabled { get; set; } = false;

        // Navigation property for LawyerProfile (One-to-One)
        [JsonIgnore]
        public LawyerProfile? LawyerProfile { get; set; }
    }
}
