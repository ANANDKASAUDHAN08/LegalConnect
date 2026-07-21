using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
{
    public class ConsentPreference
    {
        [Key]
        public int Id { get; set; }

        public int? UserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string AnonymousId { get; set; } = string.Empty;

        public bool EssentialConsent { get; set; } = true;

        public bool AnalyticsConsent { get; set; } = false;

        public bool MarketingConsent { get; set; } = false;

        public DateTime ConsentedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Per-category timestamp: when analytics consent was last toggled.</summary>
        public DateTime? AnalyticsConsentedAt { get; set; }

        /// <summary>Per-category timestamp: when marketing consent was last toggled.</summary>
        public DateTime? MarketingConsentedAt { get; set; }

        /// <summary>The privacy policy version the user consented under.</summary>
        [MaxLength(20)]
        public string PolicyVersion { get; set; } = "1.0";

        [MaxLength(45)]
        public string IpAddress { get; set; } = string.Empty;

        [MaxLength(500)]
        public string UserAgent { get; set; } = string.Empty;
    }
}