using System;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Models
{
    [Index(nameof(TargetType), nameof(TargetId), IsUnique = true)]
    public class InteractionCounter
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(40)]
        public string TargetType { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string TargetId { get; set; } = string.Empty;

        public int LikesCount { get; set; } = 0;

        public int HelpfulCount { get; set; } = 0;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}