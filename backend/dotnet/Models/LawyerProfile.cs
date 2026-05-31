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

        [MaxLength(500)]
        public string OfficeAddress { get; set; } = string.Empty;

        [MaxLength(200)]
        public string Education { get; set; } = string.Empty;

        [MaxLength(100)]
        public string LanguagesSpoken { get; set; } = "English";

        public bool IsAvailable { get; set; } = true;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
