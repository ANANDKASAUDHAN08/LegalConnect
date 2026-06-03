using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoreApi.Models
{
    public class LawyerProfile
    {
        [Key]
        public int Id { get; set; }

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

        public string? BannerUrl { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}