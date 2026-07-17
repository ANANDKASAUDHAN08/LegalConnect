using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoreApi.Models
{
    public enum AnnouncementType
    {
        MajorRelease = 1,
        MajorBugFix = 2,
        SecurityPatch = 3,
        Maintenance = 4
    }

    public class SystemAnnouncement
    {
        [Key]
        public int Id { get; set; }

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

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
    }

    public class UserAnnouncementRead
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        public int AnnouncementId { get; set; }

        [ForeignKey("AnnouncementId")]
        public SystemAnnouncement? Announcement { get; set; }

        public DateTime ReadAt { get; set; } = DateTime.UtcNow;

        public bool DismissedModal { get; set; } = false;
    }
}