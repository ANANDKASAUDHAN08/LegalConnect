using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CoreApi.Models
{
    public class LoginHistory
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        [MaxLength(250)]
        public string UserAgent { get; set; } = "Unknown Device";

        [MaxLength(50)]
        public string IpAddress { get; set; } = "Unknown IP";

        public DateTime LoginTime { get; set; } = DateTime.UtcNow;

        [MaxLength(50)]
        public string Status { get; set; } = "Success"; // Success, Failed

        [JsonIgnore]
        public User? User { get; set; }
    }
}
