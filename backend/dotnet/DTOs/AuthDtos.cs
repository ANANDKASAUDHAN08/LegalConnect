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