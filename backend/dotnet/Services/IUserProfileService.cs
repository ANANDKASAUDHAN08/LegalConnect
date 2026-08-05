using System.Collections.Generic;
using System.Threading.Tasks;
using CoreApi.Models;

namespace CoreApi.Services
{
    public interface IUserProfileService
    {
        Task<UserProfileResponseDto?> GetProfileAsync(int userId);
        Task<UserProfileResponseDto> UpdateProfileAsync(int userId, UpdateProfileDto request);
        Task<bool> DeleteAccountAsync(int userId);
        Task<object> VerifyIdentityAsync(int userId, VerifyIdentityDto request);
        Task<List<object>> GetActiveSessionsAsync(int userId, string? currentSessionId);
        Task<bool> RevokeSessionAsync(int userId, int sessionId, string? ipAddress);
        Task<bool> RevokeAllSessionsAsync(int userId, string? ipAddress);
        Task<List<object>> GetLoginHistoryAsync(int userId);
        Task<byte[]> ExportUserDataAsync(int userId);
        
        // Settings & Account Security
        Task<UserSettingsDto?> GetSettingsAsync(int userId);
        Task<bool> UpdateSettingsAsync(int userId, UpdateSettingsDto request);
        Task<object?> Get2FaSetupAsync(int userId);
        Task<(bool success, string message, bool isTwoFactorEnabled)> Toggle2FaAsync(int userId, Toggle2FaDto request);
        Task<(bool success, string message)> ChangePasswordAsync(int userId, ChangePasswordDto request);
    }

    public class UserProfileResponseDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? Phone { get; set; }
        public bool IsPhoneVerified { get; set; }
        public bool IsEmailVerified { get; set; }
        public bool IsTwoFactorEnabled { get; set; }
        public string? ClientLanguage { get; set; }
        public string? ClientCity { get; set; }
        public string? ClientInterest { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? AddressLine1 { get; set; }
        public string? ClientState { get; set; }
        public string? ClientZip { get; set; }
        public string? ClientBio { get; set; }
        public string? AvatarUrl { get; set; }
        public string IdentityStatus { get; set; } = string.Empty;
        public string? IdentityDocumentUrl { get; set; }
    }
}