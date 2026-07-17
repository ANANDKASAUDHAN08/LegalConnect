using System;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.Models
{
    public class CreateAnnouncementDto
    {
        [Required]
        [MaxLength(20)]
        public string Version { get; set; } = "1.0.0";

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Summary { get; set; } = string.Empty;

        public string? DetailsMarkdown { get; set; }

        [Required]
        public AnnouncementType Type { get; set; } = AnnouncementType.MajorRelease;

        public bool IsModalTrigger { get; set; } = true;
    }

    public class SystemAnnouncementDto
    {
        public int Id { get; set; }
        public string Version { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? DetailsMarkdown { get; set; }
        public string TypeName { get; set; } = string.Empty;
        public int TypeValue { get; set; }
        public bool IsModalTrigger { get; set; }
        public bool IsRead { get; set; }
        public bool IsDismissedModal { get; set; }
        public DateTime PublishedAt { get; set; }
    }

    public class VersionCheckDto
    {
        public string CurrentVersion { get; set; } = "1.0.0";
        public bool HasMajorUpdate { get; set; }
        public int LatestAnnouncementId { get; set; }
        public string LatestTitle { get; set; } = string.Empty;
    }
}