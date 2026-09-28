using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.DTOs
{
    public class GoogleLoginDto
    {
        [Required]
        public string Credential { get; set; } = string.Empty;

        public string? Role { get; set; } = "Client";
    }

    public class VerifyEmailDto : IValidatableObject
    {
        public string? Token { get; set; }
        public string? Code { get; set; }

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (string.IsNullOrWhiteSpace(Token) && string.IsNullOrWhiteSpace(Code))
            {
                yield return new ValidationResult(
                    "Either verification 'Token' or 6-digit 'Code' must be provided.",
                    new[] { nameof(Token), nameof(Code) });
            }
        }
    }

    public class ResendEmailVerificationDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public class SendPhoneOtpDto
    {
        [Required]
        public string Phone { get; set; } = string.Empty;
        public string Channel { get; set; } = "whatsapp"; // "whatsapp", "email", "sms"
    }

    public class VerifyPhoneOtpDto
    {
        [Required]
        public string Phone { get; set; } = string.Empty;

        [Required]
        [RegularExpression(@"^\d{6}$", ErrorMessage = "Verification code must be exactly 6 digits.")]
        public string Code { get; set; } = string.Empty;
    }

    public class PhoneOtpResponseDto
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public string Channel { get; set; } = "whatsapp";
        public string TargetPhone { get; set; } = string.Empty;
        public int CooldownSeconds { get; set; } = 60;
        public string? DirectWhatsAppUrl { get; set; }
        public bool CanFallbackToEmail { get; set; }
        public string? UserEmail { get; set; }
    }

    public class OtpSession
    {
        public int UserId { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Channel { get; set; } = "whatsapp";
        public int AttemptsRemaining { get; set; } = 5;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddMinutes(10);
    }

    public class VerificationResponseDto
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? VerifiedField { get; set; }
        public string? VerifiedValue { get; set; }
        public DateTime VerifiedAt { get; set; } = DateTime.UtcNow;
    }

    public class FirebaseLookupUser
    {
        public string? LocalId { get; set; }
        public string? Email { get; set; }
        public bool EmailVerified { get; set; }
        public string? PhoneNumber { get; set; }
    }

    public class FirebaseLookupResponse
    {
        public List<FirebaseLookupUser>? Users { get; set; }
    }
}