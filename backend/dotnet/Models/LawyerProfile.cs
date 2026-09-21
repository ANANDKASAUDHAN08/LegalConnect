using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoreApi.Models
{
    public class LawyerProfile
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Enterprise non-sequential public identifier exposed in APIs and client displays (e.g. law_89f210ad45b1c74e).
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string PublicId { get; set; } = CoreApi.Extensions.PublicIdGenerator.Generate("law");

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [MaxLength(50)]
        public string BarCouncilNumber { get; set; } = string.Empty;

        [MaxLength(200)]
        public string Specialization { get; set; } = string.Empty;

        public int ExperienceYears { get; set; }

        public bool IsVerified { get; set; } = false;

        [MaxLength(100)]
        public string City { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string Bio { get; set; } = string.Empty;

        [MaxLength(20)]
        public string Phone { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18, 2)")]
        public decimal ConsultationFee { get; set; } = 0.00m;

        [Column(TypeName = "decimal(18, 2)")]
        public decimal InPersonFee { get; set; } = 0.00m;

        public int CasesCompleted { get; set; } = 150;

        public int SuccessRate { get; set; } = 95;

        [MaxLength(500)]
        public string OfficeAddress { get; set; } = string.Empty;

        [MaxLength(200)]
        public string Education { get; set; } = string.Empty;

        [MaxLength(100)]
        public string LanguagesSpoken { get; set; } = "English";

        public bool IsAvailable { get; set; } = true;

        [MaxLength(500)]
        public string ActiveCourts { get; set; } = string.Empty;

        [MaxLength(100)]
        public string ResponseTime { get; set; } = "Responds within 24 hours";

        [MaxLength(200)]
        public string WorkingHours { get; set; } = "Mon - Fri: 9:00 AM - 6:00 PM";

        public string FaqsJson { get; set; } = "[]";

        public string AccoladesJson { get; set; } = "[]";

        public string CasesJson { get; set; } = "[]";

        public string TimeSlotsJson { get; set; } = "[]";

        public string SocialLinksJson { get; set; } = "{}";

        public string? VerificationRemarks { get; set; }

        public DateTime? CopExpiryDate { get; set; }

        public string? BannerUrl { get; set; }

        // ── Enterprise / MNC Counsel Compliance Fields ───────────────────
        /// <summary>Name of the law firm or chamber</summary>
        [MaxLength(200)]
        public string? LawFirmName { get; set; }

        /// <summary>Practice structure: Solo / Partnership / LLP / AOP</summary>
        [MaxLength(50)]
        public string? PracticeStructure { get; set; }

        /// <summary>Professional indemnity (E&O) insurance carrier name</summary>
        [MaxLength(150)]
        public string? ProfessionalIndemnityInsurer { get; set; }

        /// <summary>E&O insurance policy number</summary>
        [MaxLength(80)]
        public string? ProfessionalIndemnityPolicyNo { get; set; }

        /// <summary>E&O coverage amount</summary>
        [Column(TypeName = "decimal(18, 2)")]
        public decimal? ProfessionalIndemnityCoverage { get; set; }

        /// <summary>E&O policy expiry date</summary>
        public DateTime? ProfessionalIndemnityExpiryDate { get; set; }

        /// <summary>Hourly billing rate</summary>
        [Column(TypeName = "decimal(18, 2)")]
        public decimal? HourlyRate { get; set; }

        /// <summary>Monthly retainer fee</summary>
        [Column(TypeName = "decimal(18, 2)")]
        public decimal? RetainerFee { get; set; }

        /// <summary>Whether conflict-of-interest check is mandatory before engagement</summary>
        public bool ConflictCheckRequired { get; set; } = false;

        /// <summary>Lawyer/Firm GSTIN for GST-compliant invoicing</summary>
        [MaxLength(20)]
        public string? GstinLawyer { get; set; }

        /// <summary>Issuing state bar council (e.g. Bar Council of Delhi)</summary>
        [MaxLength(100)]
        public string? StateBarCouncil { get; set; }

        /// <summary>Chambers & Partners / Legal500 / RSG India structured rankings JSON</summary>
        public string DirectoryRankingsJson { get; set; } = "[]";

        /// <summary>Anonymized representative matters / deal sheet JSON</summary>
        public string RepresentativeMattersJson { get; set; } = "[]";

        /// <summary>Whether lawyer has accepted platform Master Service Agreement</summary>
        public bool MsaAccepted { get; set; } = false;

        /// <summary>Fee quotation currency: INR / USD / GBP / SGD / EUR</summary>
        [MaxLength(5)]
        public string Currency { get; set; } = "INR";

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}