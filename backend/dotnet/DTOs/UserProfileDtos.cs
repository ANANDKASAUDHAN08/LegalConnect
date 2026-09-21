using System;

namespace CoreApi.DTOs
{
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
        public string? Pronouns { get; set; }
        public string? SpecialStatus { get; set; }
        public string? LegalEntityName { get; set; }
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public string? EmergencyContactRelation { get; set; }
        public bool CorporateRfpOpen { get; set; }
        public bool IsSearchIndexable { get; set; } = true;
        public bool IsCorporateEntity { get; set; } = false;

        // ── Enterprise / MNC Corporate Compliance ────────────────────────
        public string? CIN { get; set; }
        public string? EntityType { get; set; }
        public string? Gstin { get; set; }
        public string? IncorporationNumber { get; set; }
        public string? IndustryVertical { get; set; }
        public string? CompanySize { get; set; }
        public decimal? LegalBudgetCeiling { get; set; }
        public string? PanNumber { get; set; }
        public string Currency { get; set; } = "INR";
        public bool MsaAccepted { get; set; } = false;
        public DateTime? MsaAcceptedAt { get; set; }
        public string? DpoContactName { get; set; }
        public string? DpoContactEmail { get; set; }
    }
}