using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Models
{
    /// <summary>
    /// Unified polymorphic bookmark entity replacing legacy FavouriteLawyer,
    /// FavouriteResource, FavouriteHelpline, and Bookmark tables.
    /// Compound unique index on (UserId, TargetType, TargetId) prevents duplicates.
    /// v1: CollectionName is a simple string field. v2: Promote to FK → BookmarkCollection entity.
    /// </summary>
    [Index(nameof(UserId), nameof(TargetType), nameof(TargetId), IsUnique = true)]
    [Index(nameof(UserId), nameof(CollectionName))]
    public class UserBookmark
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        /// <summary>
        /// The entity type: "Lawyer", "LegalResource", "BareActSection", "Helpline", "Template"
        /// </summary>
        [Required]
        [MaxLength(40)]
        public string TargetType { get; set; } = string.Empty;

        /// <summary>
        /// Supports both stringified SQL int IDs and MongoDB ObjectId strings.
        /// For BareActSection: "ActShortName::SectionNumber" composite key.
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string TargetId { get; set; } = string.Empty;

        /// <summary>
        /// Primary display title for the bookmarked item.
        /// </summary>
        [Required]
        [MaxLength(250)]
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// Optional subtitle for context (e.g., "Chapter III · BNS", "Section 420 IPC - Cheating").
        /// </summary>
        [MaxLength(100)]
        public string? Subtitle { get; set; }

        /// <summary>
        /// User-provided notes attached to this bookmark.
        /// </summary>
        [MaxLength(500)]
        public string? CustomNotes { get; set; }

        /// <summary>
        /// v1: Simple string folder name. Defaults to "General".
        /// </summary>
        [MaxLength(80)]
        public string CollectionName { get; set; } = "General";

        /// <summary>
        /// JSON blob storing additional metadata: { routeUrl, thumbnail, badgeTags[], entitySubtype }.
        /// Enables rich card rendering in Saved Workbench without refetching entity data.
        /// </summary>
        [Column(TypeName = "json")]
        public string? MetadataJson { get; set; }

        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }
}