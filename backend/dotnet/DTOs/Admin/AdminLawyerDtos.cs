using System.Collections.Generic;

namespace CoreApi.DTOs.Admin
{
    public class AdminBulkVerifyLawyersDto
    {
        public List<int> LawyerIds { get; set; } = new();
        public bool IsVerified { get; set; }
    }

    public class AdminVerifyLawyerDto
    {
        public bool IsVerified { get; set; }
        public string? Remarks { get; set; }
    }

    public class AdminUpdateLawyerProfileDto
    {
        public string? BarCouncilNumber { get; set; }
        public string? Specialization { get; set; }
        public int? ExperienceYears { get; set; }
        public string? City { get; set; }
        public decimal? ConsultationFee { get; set; }
        public decimal? InPersonFee { get; set; }
        public string? OfficeAddress { get; set; }
        public string? Bio { get; set; }
        public string? ActiveCourts { get; set; }
        public string? VerificationRemarks { get; set; }
        public bool? IsAvailable { get; set; }
        public bool? IsVerified { get; set; }
    }
}