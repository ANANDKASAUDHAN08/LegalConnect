namespace CoreApi.DTOs
{
    public class UpdateLawyerProfileDto
    {
        public string BarCouncilNumber { get; set; } = string.Empty;
        public string Specialization { get; set; } = string.Empty;
        public int ExperienceYears { get; set; }
        public string City { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public decimal ConsultationFee { get; set; }
        public decimal InPersonFee { get; set; }
        public int CasesCompleted { get; set; }
        public int SuccessRate { get; set; }
        public string OfficeAddress { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
        public string LanguagesSpoken { get; set; } = string.Empty;
        public bool IsAvailable { get; set; }
        // Premium additions
        public string ActiveCourts { get; set; } = string.Empty;
        public string ResponseTime { get; set; } = string.Empty;
        public string WorkingHours { get; set; } = string.Empty;
        public string FaqsJson { get; set; } = string.Empty;
        public string AccoladesJson { get; set; } = string.Empty;
        public string CasesJson { get; set; } = string.Empty;
        public string TimeSlotsJson { get; set; } = string.Empty;
        public string SocialLinksJson { get; set; } = string.Empty;
        public string? BannerUrl { get; set; }
        // ── Enterprise / MNC Counsel Compliance ──────────────────────────
        public string? LawFirmName { get; set; }
        public string? PracticeStructure { get; set; }
        public string? ProfessionalIndemnityInsurer { get; set; }
        public string? ProfessionalIndemnityPolicyNo { get; set; }
        public decimal? ProfessionalIndemnityCoverage { get; set; }
        public DateTime? ProfessionalIndemnityExpiryDate { get; set; }
        public decimal? HourlyRate { get; set; }
        public decimal? RetainerFee { get; set; }
        public bool? ConflictCheckRequired { get; set; }
        public string? GstinLawyer { get; set; }
        public string? StateBarCouncil { get; set; }
        public string? DirectoryRankingsJson { get; set; }
        public string? RepresentativeMattersJson { get; set; }
        public bool? MsaAccepted { get; set; }
        public string? Currency { get; set; }
    }
}