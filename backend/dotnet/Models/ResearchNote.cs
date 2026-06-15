using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CoreApi.Models
{
    public class ResearchNote
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ClientId { get; set; }

        [ForeignKey("ClientId")]
        public User? Client { get; set; }

        [Required]
        [MaxLength(50)]
        public string ActShortName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string SectionNumber { get; set; } = string.Empty;

        [Required]
        public string NoteText { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
