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

    public class VerifyEmailDto
    {
        [Required]
        public string Token { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
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