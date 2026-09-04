using System;

namespace CoreApi.DTOs
{
    public class UserProfileResponseDto
    {
        public int Id { get; set; }
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
        public string? ClientInterest { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? AddressLine1 { get; set; }
        public string? ClientState { get; set; }
        public string? ClientZip { get; set; }
        public string? ClientBio { get; set; }
        public string? AvatarUrl { get; set; }
        public string IdentityStatus { get; set; } = string.Empty;
        public string? IdentityDocumentUrl { get; set; }
    }
}