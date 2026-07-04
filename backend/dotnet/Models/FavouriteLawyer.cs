using System;

namespace CoreApi.Models
{
    public class FavouriteLawyer
    {
        public int Id { get; set; }
        public int ClientId { get; set; }
        public User Client { get; set; } = null!;
        public string LawyerId { get; set; } = string.Empty; // MongoDB ObjectId string from Node backend
        public string LawyerName { get; set; } = string.Empty; // Denormalized for display
        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }
}
