using System;

namespace CoreApi.Models
{
    public class FavouriteResource
    {
        public int Id { get; set; }
        public int ClientId { get; set; }
        public User Client { get; set; } = null!;
        public string ResourceId { get; set; } = string.Empty; // MongoDB ObjectId string for LegalResource
        public string ResourceName { get; set; } = string.Empty; // Denormalized for display
        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }
}
