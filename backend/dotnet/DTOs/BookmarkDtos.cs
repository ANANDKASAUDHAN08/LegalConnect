using System.Collections.Generic;

namespace CoreApi.DTOs
{
    public class AddBookmarkDto
    {
        public string ActShortName { get; set; } = string.Empty;
        public string ChapterNumber { get; set; } = string.Empty;
        public string SectionNumber { get; set; } = string.Empty;
        public string SectionTitle { get; set; } = string.Empty;
        public string SectionContent { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public string? CollectionName { get; set; }
    }

    public class UpdateBookmarkDto
    {
        public string? Notes { get; set; }
        public string? CollectionName { get; set; }
    }

    public class ToggleBookmarkDto
    {
        public string TargetType { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Subtitle { get; set; }
        public string? CollectionName { get; set; }
        public string? MetadataJson { get; set; }
    }

    public class UpdateUniversalBookmarkDto
    {
        public string? CustomNotes { get; set; }
        public string? CollectionName { get; set; }
        public string? MetadataJson { get; set; }
    }

    public class BookmarkBatchStatusDto
    {
        public string TargetType { get; set; } = string.Empty;
        public List<string> TargetIds { get; set; } = new();
    }
}