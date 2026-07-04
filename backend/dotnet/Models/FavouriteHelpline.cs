using System;

namespace CoreApi.Models
{
    public class FavouriteHelpline
    {
        public int Id { get; set; }
        public int ClientId { get; set; }
        public User Client { get; set; } = null!;
        public string HelplineId { get; set; } = string.Empty; // MongoDB ObjectId string for HelpHelpline
        public string HelplineName { get; set; } = string.Empty; // Denormalized for display
        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }
}
