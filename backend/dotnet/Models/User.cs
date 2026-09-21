using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CoreApi.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Enterprise non-sequential public identifier exposed in APIs, JWTs, and client displays (e.g. usr_c74e89f210ad45b1).
        /// Protects against IDOR enumeration and business metric leakage.
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string PublicId { get; set; } = CoreApi.Extensions.PublicIdGenerator.Generate("usr");

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

        public bool IsActive { get; set; } = true;

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

        /// <summary>
        /// UTC timestamp when the pending 2FA secret was generated during setup.
        /// Used to implement idempotent setup: if a pending secret exists and is recent (within 30 min),
        /// the same secret is returned instead of generating a new one. Null after verification or expiry.
        /// </summary>
        public DateTime? TwoFactorPendingAt { get; set; }

        /// <summary>
        /// JSON array of BCrypt-hashed one-time backup codes for 2FA recovery.
        /// Each code can only be used once; consumed codes are removed from the array.
        /// </summary>
        [MaxLength(2000)]
        public string? TwoFactorBackupCodes { get; set; }

        /// <summary>
        /// Flag indicating the user (e.g. seeded administrator) must change their password on next login.
        /// </summary>
        public bool MustChangePassword { get; set; } = false;

        // ── Progressive Account Lockout (Brute-Force Protection) ──
        /// <summary>
        /// Consecutive failed login attempts. Resets to 0 on successful login.
        /// Lockout policy: 5 failures → 15 min lock, 10 failures → 1 hour lock, 15+ → 24 hour lock.
        /// </summary>
        public int FailedLoginAttempts { get; set; } = 0;

        /// <summary>
        /// UTC timestamp until which the account is locked. Null = not locked.
        /// </summary>
        public DateTime? LockoutEnd { get; set; }

        [MaxLength(50)]
        public string AuthProvider { get; set; } = "Email + Password";

        public DateTime? LastLoginAt { get; set; }

        [MaxLength(50)]
        public string? LastIpAddress { get; set; }

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

        // ── Legal Budget (Client-settable, used in Spend & Insights analytics) ──
        /// <summary>
        /// Client's self-declared legal budget ceiling for spend tracking.
        /// Null means no budget set (UI will show "Set Your Budget" prompt).
        /// </summary>
        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "decimal(18,2)")]
        public decimal? LegalBudget { get; set; }

        // ── User Preference / Settings Fields ──────────────────────────────
        [MaxLength(80)]
        public string? PreferredTimezone { get; set; } = "Asia/Kolkata";

        [MaxLength(20)]
        public string? DateFormat { get; set; } = "DD/MM/YYYY";

        public bool NotifyLawAmendments { get; set; } = true;

        public bool NotifyEmailDigest { get; set; } = true;

        public bool NotifyPushEnabled { get; set; } = false;

        // ── Extended Profile & Standing Fields ─────────────────────────
        [MaxLength(50)]
        public string? Pronouns { get; set; }

        [MaxLength(100)]
        public string? SpecialStatus { get; set; } = "Standard Citizen";

        [MaxLength(200)]
        public string? LegalEntityName { get; set; }

        [MaxLength(100)]
        public string? EmergencyContactName { get; set; }

        [MaxLength(30)]
        public string? EmergencyContactPhone { get; set; }

        [MaxLength(100)]
        public string? EmergencyContactRelation { get; set; }

        public bool CorporateRfpOpen { get; set; } = false;

        // ── Privacy & Visibility Preferences ────────────────────────────
        public bool IsSearchIndexable { get; set; } = true;

        public bool IsCorporateEntity { get; set; } = false;

        // ── Enterprise / MNC Corporate Compliance Fields ──────────────────
        /// <summary>Corporate Identity Number issued by MCA21 (e.g. U74999MH2021PTC123456)</summary>
        [MaxLength(25)]
        public string? CIN { get; set; }

        /// <summary>Legal entity classification: Pvt Ltd / LLP / Public Ltd / Proprietorship / Trust / AOP</summary>
        [MaxLength(50)]
        public string? EntityType { get; set; }

        /// <summary>GST Identification Number for tax invoice generation</summary>
        [MaxLength(20)]
        public string? Gstin { get; set; }

        /// <summary>ROC Incorporation / Registration Number</summary>
        [MaxLength(50)]
        public string? IncorporationNumber { get; set; }

        /// <summary>Industry vertical: BFSI / Pharma / IT / Manufacturing / Real Estate / E-Commerce etc.</summary>
        [MaxLength(100)]
        public string? IndustryVertical { get; set; }

        /// <summary>Headcount band: 1-50 / 51-200 / 201-1000 / 1001-5000 / 5000+</summary>
        [MaxLength(30)]
        public string? CompanySize { get; set; }

        /// <summary>Annual outside-counsel budget ceiling</summary>
        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "decimal(18,2)")]
        public decimal? LegalBudgetCeiling { get; set; }

        /// <summary>PAN for TDS deduction at source (Section 194J — 10% on professional fees)</summary>
        [MaxLength(10)]
        public string? PanNumber { get; set; }

        /// <summary>Preferred billing currency: INR / USD / GBP / SGD / EUR</summary>
        [MaxLength(5)]
        public string Currency { get; set; } = "INR";

        /// <summary>Whether client has accepted the Master Service Agreement</summary>
        public bool MsaAccepted { get; set; } = false;

        /// <summary>Timestamp when MSA was accepted (audit trail)</summary>
        public DateTime? MsaAcceptedAt { get; set; }

        /// <summary>Data Protection Officer name (DPDP Act 2023 / GDPR compliance)</summary>
        [MaxLength(100)]
        public string? DpoContactName { get; set; }

        /// <summary>Data Protection Officer email</summary>
        [MaxLength(150)]
        public string? DpoContactEmail { get; set; }

        // Navigation property for LawyerProfile (One-to-One)
        [JsonIgnore]
        public LawyerProfile? LawyerProfile { get; set; }
    }
}
