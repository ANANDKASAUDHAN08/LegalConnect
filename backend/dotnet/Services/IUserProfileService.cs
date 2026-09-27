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
        Task<bool> DeactivateAccountAsync(int userId);
        Task<List<SessionResponseDto>> GetActiveSessionsAsync(int userId, string? currentSessionId);
        Task<bool> RevokeSessionAsync(int userId, int sessionId, string? ipAddress);
        Task<bool> RevokeAllSessionsAsync(int userId, string? ipAddress);
        Task<List<LoginHistoryResponseDto>> GetLoginHistoryAsync(int userId);
        Task<byte[]> ExportUserDataAsync(int userId);
        
        // Settings & Account Security
        Task<UserSettingsDto?> GetSettingsAsync(int userId);
        Task<bool> UpdateSettingsAsync(int userId, UpdateSettingsDto request);
        Task<TwoFactorSetupResponseDto?> Get2FaSetupAsync(int userId, bool force = false);
        Task<(bool success, string message, bool isTwoFactorEnabled)> Toggle2FaAsync(int userId, Toggle2FaDto request);
        Task<(bool success, string message)> ChangePasswordAsync(int userId, ChangePasswordDto request);

        // 2FA Reconfigure & Backup Code Management
        Task<TwoFactorSetupResponseDto?> Reconfigure2FaAsync(int userId, string password);
        bool CancelReconfigure2Fa(int userId);
        Task<BackupCodesResponseDto?> GetBackupCodesAsync(int userId, string password);
        Task<BackupCodesResponseDto?> RegenerateBackupCodesAsync(int userId, string password);
    }
}