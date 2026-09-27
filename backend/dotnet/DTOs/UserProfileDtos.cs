using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.DTOs
{
    public class UpdateProfileDto
    {
        [MinLength(2)]
        [MaxLength(100)]
        [RegularExpression(@"^[\p{L}\p{M}'\-\.\s]+$", ErrorMessage = "Name contains invalid characters.")]
        public string? FullName { get; set; }

        [MaxLength(20)]
        [RegularExpression(@"^\+?[\d\s\-()]{7,20}$", ErrorMessage = "Invalid phone number format.")]
        public string? Phone { get; set; }

        [MaxLength(30)]
        public string? ClientLanguage { get; set; }

        [MaxLength(100)]
        public string? ClientCity { get; set; }

        [MaxLength(100)]
        public string? ClientState { get; set; }

        [MaxLength(1000)]
        public string? ClientBio { get; set; }

        [MaxLength(2_000_000)] // ~1.5MB base64 image limit
        public string? AvatarUrl { get; set; }

        [MaxLength(80)]
        public string? PreferredTimezone { get; set; }

        public bool? NotifyLawAmendments { get; set; }
        public bool? NotifyEmailDigest { get; set; }
        public bool? NotifyPushEnabled { get; set; }
        public bool? NotifyWhatsAppEnabled { get; set; }

        [MaxLength(20)]
        [RegularExpression(@"^\+?[\d\s\-()]{7,20}$", ErrorMessage = "Invalid WhatsApp phone format.")]
        public string? WhatsAppPhone { get; set; }

        public DateTime? DateOfBirth { get; set; }

        [MaxLength(50)]
        public string? Gender { get; set; }

        public bool? IsTwoFactorEnabled { get; set; }
        public bool? IsSearchIndexable { get; set; }
    }

    public class UserProfileResponseDto
    {
        public int Id { get; set; }
        public string PublicId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? Phone { get; set; }
        public bool IsPhoneVerified { get; set; }
        public bool IsEmailVerified { get; set; }
        public bool IsTwoFactorEnabled { get; set; }
        public string? ClientLanguage { get; set; }
        public string? ClientCity { get; set; }
        public string? ClientState { get; set; }
        public string? ClientBio { get; set; }
        public string? AvatarUrl { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public bool NotifyWhatsAppEnabled { get; set; } = false;
        public string? WhatsAppPhone { get; set; }
        public bool IsSearchIndexable { get; set; } = true;
    }
}