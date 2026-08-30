using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Models
{
    /// <summary>
    /// Polymorphic like/vote/helpful ledger.
    /// Replaces legacy in-memory rate-limiting and localStorage-based vote tracking
    /// with a definitive database-backed ledger per authenticated user.
    /// Compound unique index on (UserId, TargetType, TargetId) prevents duplicate votes.
    /// </summary>
    public enum InteractionType
    {
        Like = 1,
        Dislike = 2,
        Helpful = 3,
        Unhelpful = 4
    }

    [Index(nameof(UserId), nameof(TargetType), nameof(TargetId), IsUnique = true)]
    [Index(nameof(TargetType), nameof(TargetId))]
    public class UserInteraction
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        /// <summary>
        /// The entity type: "Review", "LegalResource", "Lawyer", "BareActSection", "Template"
        /// </summary>
        [Required]
        [MaxLength(40)]
        public string TargetType { get; set; } = string.Empty;

        /// <summary>
        /// Supports both stringified SQL int IDs and MongoDB ObjectId strings.
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string TargetId { get; set; } = string.Empty;

        public InteractionType Type { get; set; } = InteractionType.Like;

        [MaxLength(45)]
        public string? ClientIp { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}