using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.DTOs
{
    public class RegisterDto
    {
        [Required]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = "Client"; // "Client" or "Lawyer"
    }

    public class LoginDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;

        public string? TwoFactorCode { get; set; }
    }

    public class UpdateProfileDto
    {
        [MinLength(2)]
        public string? FullName { get; set; }

        public string? Phone { get; set; }

        public string? ClientLanguage { get; set; }

        public string? ClientCity { get; set; }

        public string? ClientInterest { get; set; }

        public DateTime? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? AddressLine1 { get; set; }
        public string? ClientState { get; set; }
        public string? ClientZip { get; set; }
        public string? ClientBio { get; set; }
        public string? AvatarUrl { get; set; }

        public string? PreferredTimezone { get; set; }
        public bool? NotifyLawAmendments { get; set; }
        public bool? NotifyEmailDigest { get; set; }
        public bool? NotifyPushEnabled { get; set; }

        public string? Pronouns { get; set; }
        public string? SpecialStatus { get; set; }
        public string? LegalEntityName { get; set; }
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public string? EmergencyContactRelation { get; set; }
        public bool? CorporateRfpOpen { get; set; }
        public bool? IsTwoFactorEnabled { get; set; }
        public bool? IsSearchIndexable { get; set; }
        public bool? IsCorporateEntity { get; set; }

        // ── Enterprise / MNC Corporate Compliance ────────────────────────
        public string? CIN { get; set; }
        public string? EntityType { get; set; }
        public string? Gstin { get; set; }
        public string? IncorporationNumber { get; set; }
        public string? IndustryVertical { get; set; }
        public string? CompanySize { get; set; }
        public decimal? LegalBudgetCeiling { get; set; }
        public string? PanNumber { get; set; }
        public string? Currency { get; set; }
        public bool? MsaAccepted { get; set; }
        public string? DpoContactName { get; set; }
        public string? DpoContactEmail { get; set; }
    }

    public class ChangePasswordDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class ForgotPasswordDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public class ResetPasswordDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Password { get; set; } = string.Empty;
    }

    public class Toggle2FaDto
    {
        public bool Enable { get; set; }
        public string Code { get; set; } = string.Empty;
        public string? Password { get; set; }
    }

    public class VerifyPhoneDto
    {
        public string Code { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? FirebaseToken { get; set; }
    }

    public class VerifyIdentityDto
    {
        [Required]
        public string DocumentType { get; set; } = string.Empty;

        [Required]
        public string DocumentFile { get; set; } = string.Empty;
    }

    public class UserSettingsDto
    {
        // Language & Region
        public string? ClientLanguage { get; set; }
        public string? PreferredTimezone { get; set; }
        public string? DateFormat { get; set; }

        // Notifications
        public bool NotifyLawAmendments { get; set; }
        public bool NotifyEmailDigest { get; set; }
        public bool NotifyPushEnabled { get; set; }
    }

    public class UpdateSettingsDto
    {
        // Language & Region
        public string? ClientLanguage { get; set; }

        [MaxLength(80)]
        public string? PreferredTimezone { get; set; }

        [MaxLength(20)]
        public string? DateFormat { get; set; }

        // Notifications
        public bool? NotifyLawAmendments { get; set; }
        public bool? NotifyEmailDigest { get; set; }
        public bool? NotifyPushEnabled { get; set; }
    }

    public class RefreshRequestDto
    {
        public string? RefreshToken { get; set; }
    }

    public class ReconfigureDto
    {
        public string Password { get; set; } = string.Empty;
    }

    public class PasswordConfirmDto
    {
        public string Password { get; set; } = string.Empty;
    }
}