using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
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
    }

    public class VerifyPhoneDto
    {
        public string Code { get; set; } = string.Empty;
    }

    public class VerifyIdentityDto
    {
        [Required]
        public string DocumentType { get; set; } = string.Empty;

        [Required]
        public string DocumentFile { get; set; } = string.Empty;
    }
}
