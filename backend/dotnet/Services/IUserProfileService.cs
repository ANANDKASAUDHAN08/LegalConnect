using System.Collections.Generic;
using System.Threading.Tasks;
using CoreApi.DTOs;
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
}