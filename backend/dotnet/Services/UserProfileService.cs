using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    public class UserProfileService : IUserProfileService
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;
        private readonly ILawyerSyncService _syncService;
        private readonly ILogger<UserProfileService> _logger;

        public UserProfileService(
            AppDbContext context,
            IWebHostEnvironment env,
            IConfiguration configuration,
            ILawyerSyncService syncService,
            ILogger<UserProfileService> logger)
        {
            _context = context;
            _env = env;
            _configuration = configuration;
            _syncService = syncService;
            _logger = logger;
        }

        public async Task<UserProfileResponseDto?> GetProfileAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            return MapToResponseDto(user);
        }

        public async Task<UserProfileResponseDto> UpdateProfileAsync(int userId, UpdateProfileDto request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new KeyNotFoundException("User not found.");

            if (request.FullName != null) user.FullName = request.FullName;
            if (request.Phone != null) user.Phone = request.Phone;
            if (request.ClientLanguage != null) user.ClientLanguage = request.ClientLanguage;
            if (request.ClientCity != null) user.ClientCity = request.ClientCity;
            if (request.ClientInterest != null) user.ClientInterest = request.ClientInterest;
            if (request.DateOfBirth != null) user.DateOfBirth = request.DateOfBirth;
            if (request.Gender != null) user.Gender = request.Gender;
            if (request.AddressLine1 != null) user.AddressLine1 = request.AddressLine1;
            if (request.ClientState != null) user.ClientState = request.ClientState;
            if (request.ClientZip != null) user.ClientZip = request.ClientZip;
            if (request.ClientBio != null) user.ClientBio = request.ClientBio;
            if (request.AvatarUrl != null) user.AvatarUrl = SaveBase64File(request.AvatarUrl, "avatars", $"user_{userId}");

            if (request.PreferredTimezone != null) user.PreferredTimezone = request.PreferredTimezone;
            if (request.NotifyLawAmendments.HasValue) user.NotifyLawAmendments = request.NotifyLawAmendments.Value;
            if (request.NotifyEmailDigest.HasValue) user.NotifyEmailDigest = request.NotifyEmailDigest.Value;
            if (request.NotifyPushEnabled.HasValue) user.NotifyPushEnabled = request.NotifyPushEnabled.Value;

            await _context.SaveChangesAsync();

            if (user.Role != null && user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
            {
                await _syncService.SyncProfileToMongoAsync(user.Id);
            }

            return MapToResponseDto(user);
        }

        public async Task<bool> DeleteAccountAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;

            var userEmail = user.Email;
            var isLawyer = user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase);

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            if (isLawyer)
            {
                try
                {
                    var nodeBaseUrl = _configuration["NodeServices:BaseUrl"] ?? (_env.IsDevelopment() ? "http://localhost:5000" : null);
                    if (!string.IsNullOrEmpty(nodeBaseUrl))
                    {
                        using var httpClient = new HttpClient { Timeout = TimeSpan.FromMilliseconds(800) };
                        var nodeUrl = $"{nodeBaseUrl}/api/lawyers/sync/{userEmail}";
                        await httpClient.DeleteAsync(nodeUrl);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to notify Node.js backend of lawyer account deletion for {Email}", userEmail);
                }
            }

            return true;
        }

        public async Task<object> VerifyIdentityAsync(int userId, VerifyIdentityDto request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new KeyNotFoundException("User not found.");

            var fileUrl = SaveBase64File(request.DocumentFile, "documents", $"identity_user_{userId}");
            if (string.IsNullOrEmpty(fileUrl))
            {
                throw new ArgumentException("Invalid document file payload.");
            }

            user.IdentityStatus = "Verified";
            user.IdentityDocumentUrl = fileUrl;
            await _context.SaveChangesAsync();

            return new
            {
                message = "Identity document uploaded and verified successfully!",
                identityStatus = user.IdentityStatus,
                identityDocumentUrl = user.IdentityDocumentUrl
            };
        }

        public async Task<List<object>> GetActiveSessionsAsync(int userId, string? currentSessionId)
        {
            var sessions = await _context.ActiveSessions
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.LastActive)
                .ToListAsync();

            var result = new List<object>();
            foreach (var s in sessions)
            {
                result.Add(new
                {
                    id = s.Id,
                    ipAddress = s.IpAddress,
                    userAgent = s.UserAgent,
                    deviceType = ParseDeviceFromUserAgent(s.UserAgent),
                    browser = ParseBrowserFromUserAgent(s.UserAgent),
                    location = GetLocationFromIp(s.IpAddress),
                    createdAt = s.CreatedAt,
                    lastActive = s.LastActive,
                    isCurrentSession = (!string.IsNullOrEmpty(currentSessionId) && s.TokenId == currentSessionId)
                });
            }

            return result;
        }

        public async Task<bool> RevokeSessionAsync(int userId, int sessionId, string? ipAddress)
        {
            var session = await _context.ActiveSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
            if (session == null) return false;

            _context.ActiveSessions.Remove(session);

            var refreshTokens = await _context.RefreshTokens
                .Where(r => r.SessionId == session.TokenId && r.RevokedAt == null)
                .ToListAsync();

            foreach (var rt in refreshTokens)
            {
                rt.RevokedAt = DateTime.UtcNow;
                rt.RevokedByIp = ipAddress;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RevokeAllSessionsAsync(int userId, string? ipAddress)
        {
            var sessions = await _context.ActiveSessions.Where(s => s.UserId == userId).ToListAsync();
            _context.ActiveSessions.RemoveRange(sessions);

            var refreshTokens = await _context.RefreshTokens
                .Where(r => r.UserId == userId && r.RevokedAt == null)
                .ToListAsync();

            foreach (var rt in refreshTokens)
            {
                rt.RevokedAt = DateTime.UtcNow;
                rt.RevokedByIp = ipAddress;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<object>> GetLoginHistoryAsync(int userId)
        {
            var history = await _context.LoginHistories
                .Where(h => h.UserId == userId)
                .OrderByDescending(h => h.LoginTime)
                .Take(20)
                .ToListAsync();

            return history.Select(h => (object)new
            {
                id = h.Id,
                ipAddress = h.IpAddress,
                userAgent = h.UserAgent,
                deviceType = ParseDeviceFromUserAgent(h.UserAgent),
                browser = ParseBrowserFromUserAgent(h.UserAgent),
                location = GetLocationFromIp(h.IpAddress),
                loginTime = h.LoginTime,
                status = h.Status
            }).ToList();
        }

        public async Task<byte[]> ExportUserDataAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new KeyNotFoundException("User not found.");

            var bookmarks = await _context.Bookmarks.Where(b => b.ClientId == userId).ToListAsync();
            var consultations = await _context.Consultations.Where(c => c.ClientId == userId || c.LawyerId == userId).ToListAsync();
            var reviews = await _context.Reviews.Where(r => r.UserId == userId).ToListAsync();

            var dataExport = new
            {
                exportTimestamp = DateTime.UtcNow,
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Role,
                    user.Phone,
                    user.IsEmailVerified,
                    user.IsPhoneVerified,
                    user.CreatedAt,
                    user.IdentityStatus,
                    user.ClientCity,
                    user.ClientLanguage,
                    user.ClientInterest,
                    user.PreferredTimezone
                },
                bookmarks,
                consultations,
                reviews = reviews.Select(r => new { r.Id, r.Rating, r.Content, r.TargetName, r.CreatedAt })
            };

            var jsonString = JsonSerializer.Serialize(dataExport, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            return Encoding.UTF8.GetBytes(jsonString);
        }

        public async Task<UserSettingsDto?> GetSettingsAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            return new UserSettingsDto
            {
                ClientLanguage = user.ClientLanguage ?? "English",
                PreferredTimezone = user.PreferredTimezone ?? "Asia/Kolkata",
                DateFormat = user.DateFormat ?? "DD/MM/YYYY",
                NotifyLawAmendments = user.NotifyLawAmendments,
                NotifyEmailDigest = user.NotifyEmailDigest,
                NotifyPushEnabled = user.NotifyPushEnabled
            };
        }

        public async Task<bool> UpdateSettingsAsync(int userId, UpdateSettingsDto request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;

            if (request.ClientLanguage != null) user.ClientLanguage = request.ClientLanguage;
            if (request.PreferredTimezone != null) user.PreferredTimezone = request.PreferredTimezone;
            if (request.DateFormat != null) user.DateFormat = request.DateFormat;
            if (request.NotifyLawAmendments.HasValue) user.NotifyLawAmendments = request.NotifyLawAmendments.Value;
            if (request.NotifyEmailDigest.HasValue) user.NotifyEmailDigest = request.NotifyEmailDigest.Value;
            if (request.NotifyPushEnabled.HasValue) user.NotifyPushEnabled = request.NotifyPushEnabled.Value;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<object?> Get2FaSetupAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            var secret = user.TwoFactorSecret;
            if (string.IsNullOrEmpty(secret))
            {
                secret = TotpHelper.GenerateSecretKey();
                user.TwoFactorSecret = secret;
                await _context.SaveChangesAsync();
            }

            var issuer = Uri.EscapeDataString("LegalConnect");
            var email = Uri.EscapeDataString(user.Email);
            var totpUri = $"otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}";
            var qrCodeUrl = $"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={Uri.EscapeDataString(totpUri)}";

            return new
            {
                secret,
                qrCodeUrl
            };
        }

        public async Task<(bool success, string message, bool isTwoFactorEnabled)> Toggle2FaAsync(int userId, Toggle2FaDto request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.", false);

            if (request.Enable)
            {
                if (string.IsNullOrEmpty(user.TwoFactorSecret))
                {
                    return (false, "2FA setup has not been initialized.", false);
                }
                if (!TotpHelper.ValidateCode(user.TwoFactorSecret, request.Code))
                {
                    return (false, "Invalid verification code. Please check your authenticator app.", false);
                }
                user.IsTwoFactorEnabled = true;
            }
            else
            {
                user.IsTwoFactorEnabled = false;
                user.TwoFactorSecret = null;
            }

            await _context.SaveChangesAsync();
            var msg = user.IsTwoFactorEnabled ? "2FA activated successfully!" : "2FA deactivated successfully!";
            return (true, msg, user.IsTwoFactorEnabled);
        }

        public async Task<(bool success, string message)> ChangePasswordAsync(int userId, ChangePasswordDto request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.");

            bool isCurrentValid = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash);
            if (!isCurrentValid) return (false, "Current password is incorrect.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();

            return (true, "Password changed successfully!");
        }

        private static UserProfileResponseDto MapToResponseDto(User user)
        {
            return new UserProfileResponseDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt,
                Phone = user.Phone,
                IsPhoneVerified = user.IsPhoneVerified,
                IsEmailVerified = user.IsEmailVerified,
                IsTwoFactorEnabled = user.IsTwoFactorEnabled,
                ClientLanguage = user.ClientLanguage,
                ClientCity = user.ClientCity,
                ClientInterest = user.ClientInterest,
                DateOfBirth = user.DateOfBirth,
                Gender = user.Gender,
                AddressLine1 = user.AddressLine1,
                ClientState = user.ClientState,
                ClientZip = user.ClientZip,
                ClientBio = user.ClientBio,
                AvatarUrl = user.AvatarUrl,
                IdentityStatus = user.IdentityStatus,
                IdentityDocumentUrl = user.IdentityDocumentUrl
            };
        }

        private string? SaveBase64File(string? base64Data, string subfolder, string fileNamePrefix)
        {
            if (string.IsNullOrEmpty(base64Data)) return null;
            if (base64Data.StartsWith("/") || base64Data.StartsWith("http") || !base64Data.Contains("base64,"))
            {
                return base64Data;
            }

            try
            {
                var parts = base64Data.Split("base64,");
                if (parts.Length < 2) return base64Data;

                var bytes = Convert.FromBase64String(parts[1]);
                var extension = ".jpg";
                var prefix = parts[0];
                if (prefix.Contains("image/png")) extension = ".png";
                else if (prefix.Contains("image/gif")) extension = ".gif";
                else if (prefix.Contains("image/webp")) extension = ".webp";
                else if (prefix.Contains("pdf")) extension = ".pdf";

                var uploadsFolder = Path.Combine(_env.ContentRootPath, "uploads", subfolder);
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var fileName = $"{fileNamePrefix}_{DateTime.UtcNow.Ticks}{extension}";
                var filePath = Path.Combine(uploadsFolder, fileName);
                File.WriteAllBytes(filePath, bytes);

                return $"/uploads/{subfolder}/{fileName}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving base64 file for {Prefix}", fileNamePrefix);
                return base64Data;
            }
        }

        private static string ParseDeviceFromUserAgent(string? ua)
        {
            if (string.IsNullOrEmpty(ua)) return "Unknown Device";
            if (ua.Contains("Mobile") || ua.Contains("Android") || ua.Contains("iPhone")) return "Mobile Phone";
            if (ua.Contains("iPad") || ua.Contains("Tablet")) return "Tablet";
            return "Desktop Computer";
        }

        private static string ParseBrowserFromUserAgent(string? ua)
        {
            if (string.IsNullOrEmpty(ua)) return "Unknown Browser";
            if (ua.Contains("Edg")) return "Microsoft Edge";
            if (ua.Contains("Chrome")) return "Google Chrome";
            if (ua.Contains("Safari") && !ua.Contains("Chrome")) return "Apple Safari";
            if (ua.Contains("Firefox")) return "Mozilla Firefox";
            return "Web Browser";
        }

        private static string GetLocationFromIp(string? ip)
        {
            if (string.IsNullOrEmpty(ip) || ip == "127.0.0.1" || ip == "::1") return "Local Network (Dev)";
            return "India";
        }
    }
}