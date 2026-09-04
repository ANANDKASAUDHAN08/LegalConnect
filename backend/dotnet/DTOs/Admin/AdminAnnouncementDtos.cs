using System;
using CoreApi.Models;

namespace CoreApi.DTOs.Admin
{
    public class AnnouncementCreateDto
    {
        public string Version { get; set; } = "1.0.0";
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? DetailsMarkdown { get; set; }
        public AnnouncementType Type { get; set; } = AnnouncementType.MajorRelease;
        public bool IsModalTrigger { get; set; } = true;
        public bool IsActive { get; set; } = true;
        public DateTime? PublishedAt { get; set; }
    }
}