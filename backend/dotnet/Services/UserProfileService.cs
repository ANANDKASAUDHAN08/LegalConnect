using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.DTOs;
using CoreApi.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using QRCoder;

namespace CoreApi.Services
{
    public class PendingReconfigureSession
    {
        public string Secret { get; set; } = string.Empty;
        public List<string> HashedBackupCodes { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class UserProfileService : IUserProfileService
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;
        private readonly ILawyerSyncService _syncService;
        private readonly ILogger<UserProfileService> _logger;
        private readonly IMemoryCache _cache;
        private readonly IHttpClientFactory _httpClientFactory;

        public UserProfileService(
            AppDbContext context,
            IWebHostEnvironment env,
            IConfiguration configuration,
            ILawyerSyncService syncService,
            ILogger<UserProfileService> logger,
            IMemoryCache cache,
            IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _env = env;
            _configuration = configuration;
            _syncService = syncService;
            _logger = logger;
            _cache = cache;
            _httpClientFactory = httpClientFactory;
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

            // Sanitize text inputs to prevent stored XSS
            if (request.FullName != null) user.FullName = System.Net.WebUtility.HtmlEncode(request.FullName.Trim());
            if (request.Phone != null) user.Phone = request.Phone.Trim();
            if (request.ClientLanguage != null) user.ClientLanguage = System.Net.WebUtility.HtmlEncode(request.ClientLanguage.Trim());
            if (request.ClientCity != null) user.ClientCity = System.Net.WebUtility.HtmlEncode(request.ClientCity.Trim());
            if (request.ClientState != null) user.ClientState = System.Net.WebUtility.HtmlEncode(request.ClientState.Trim());
            if (request.ClientBio != null) user.ClientBio = System.Net.WebUtility.HtmlEncode(request.ClientBio.Trim());
            if (request.AvatarUrl != null) user.AvatarUrl = await SaveBase64FileAsync(request.AvatarUrl, "avatars", $"user_{userId}");

            if (request.PreferredTimezone != null) user.PreferredTimezone = request.PreferredTimezone.Trim();
            if (request.NotifyLawAmendments.HasValue) user.NotifyLawAmendments = request.NotifyLawAmendments.Value;
            if (request.NotifyEmailDigest.HasValue) user.NotifyEmailDigest = request.NotifyEmailDigest.Value;
            if (request.NotifyPushEnabled.HasValue) user.NotifyPushEnabled = request.NotifyPushEnabled.Value;
            if (request.NotifyWhatsAppEnabled.HasValue) user.NotifyWhatsAppEnabled = request.NotifyWhatsAppEnabled.Value;
            if (request.WhatsAppPhone != null) user.WhatsAppPhone = request.WhatsAppPhone.Trim();

            if (request.DateOfBirth.HasValue) user.DateOfBirth = request.DateOfBirth.Value;
            if (request.Gender != null) user.Gender = System.Net.WebUtility.HtmlEncode(request.Gender.Trim());

            if (request.IsSearchIndexable.HasValue) user.IsSearchIndexable = request.IsSearchIndexable.Value;

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

            // Soft-delete: mark as inactive and deleted, anonymize PII, set 30-day purge window
            user.IsDeleted = true;
            user.IsActive = false;
            user.IsSearchIndexable = false;
            user.FullName = "Deleted User";
            user.Phone = null;
            user.AvatarUrl = null;
            user.ClientBio = null;
            user.ClientCity = null;
            user.ClientState = null;

            // Revoke all active sessions and refresh tokens
            await RevokeAllSessionsAsync(userId, "Account Deletion");

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Account Deletion] User {UserId} soft-deleted. PII anonymized. Hard purge scheduled for {PurgeDate}.",
                user.Id, DateTime.UtcNow.AddDays(30));

            if (isLawyer)
            {
                try
                {
                    var nodeBaseUrl = _configuration["NodeServices:BaseUrl"] ?? (_env.IsDevelopment() ? "http://localhost:5000" : null);
                    if (!string.IsNullOrEmpty(nodeBaseUrl))
                    {
                        var httpClient = _httpClientFactory.CreateClient("NodeSync");
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

        public async Task<bool> DeactivateAccountAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;

            user.IsDeactivatedByUser = true;
            user.IsActive = false;
            user.IsSearchIndexable = false;

            // Revoke all active sessions and refresh tokens
            await RevokeAllSessionsAsync(userId, "Account Deactivation");

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Account Deactivation] User {UserId} ({Email}) deactivated their account. All sessions revoked.", user.Id, user.Email);
            return true;
        }


        public async Task<List<SessionResponseDto>> GetActiveSessionsAsync(int userId, string? currentSessionId)
        {
            var sessions = await _context.ActiveSessions
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.LastActive)
                .ToListAsync();

            var result = new List<SessionResponseDto>();
            foreach (var s in sessions)
            {
                result.Add(new SessionResponseDto
                {
                    Id = s.Id,
                    IpAddress = s.IpAddress ?? string.Empty,
                    UserAgent = s.UserAgent ?? string.Empty,
                    DeviceType = ParseDeviceFromUserAgent(s.UserAgent),
                    Browser = ParseBrowserFromUserAgent(s.UserAgent),
                    Location = GetLocationFromIp(s.IpAddress),
                    CreatedAt = s.CreatedAt,
                    LastActive = s.LastActive,
                    IsCurrentSession = (!string.IsNullOrEmpty(currentSessionId) && s.TokenId == currentSessionId)
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

        public async Task<List<LoginHistoryResponseDto>> GetLoginHistoryAsync(int userId)
        {
            var history = await _context.LoginHistories
                .Where(h => h.UserId == userId)
                .OrderByDescending(h => h.LoginTime)
                .Take(20)
                .ToListAsync();

            return history.Select(h => new LoginHistoryResponseDto
            {
                Id = h.Id,
                IpAddress = h.IpAddress ?? string.Empty,
                UserAgent = h.UserAgent ?? string.Empty,
                DeviceType = ParseDeviceFromUserAgent(h.UserAgent),
                Browser = ParseBrowserFromUserAgent(h.UserAgent),
                Location = GetLocationFromIp(h.IpAddress),
                LoginTime = h.LoginTime,
                Status = h.Status
            }).ToList();
        }

        public async Task<byte[]> ExportUserDataAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new KeyNotFoundException("User not found.");

            var bookmarks = await _context.Bookmarks.Where(b => b.ClientId == userId).ToListAsync();
            var consultations = await _context.Consultations.Where(c => c.ClientId == userId || c.LawyerId == userId).ToListAsync();
            var reviews = await _context.Reviews.Where(r => r.UserId == userId).ToListAsync();

            var loginHistory = await _context.LoginHistories
                .Where(h => h.UserId == userId)
                .OrderByDescending(h => h.LoginTime)
                .Take(100)
                .ToListAsync();

            var consentPrefs = await _context.ConsentPreferences
                .Where(c => c.UserId == userId)
                .ToListAsync();

            var favouriteLawyers = await _context.FavouriteLawyers
                .Where(f => f.ClientId == userId)
                .ToListAsync();

            var favouriteResources = await _context.FavouriteResources
                .Where(f => f.ClientId == userId)
                .ToListAsync();

            var notes = await _context.ResearchNotes
                .Where(n => n.ClientId == userId)
                .ToListAsync();

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
                    user.PreferredTimezone
                },
                bookmarks,
                consultations,
                reviews = reviews.Select(r => new { r.Id, r.Rating, r.Content, r.TargetName, r.CreatedAt }),
                loginHistory = loginHistory.Select(h => new { h.Id, h.IpAddress, h.UserAgent, h.LoginTime, h.Status }),
                consentPreferences = consentPrefs,
                favouriteLawyers,
                favouriteResources,
                researchNotes = notes
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

        public async Task<TwoFactorSetupResponseDto?> Get2FaSetupAsync(int userId, bool force = false)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            string secret;
            List<string> backupCodes;
            bool isPendingReuse = false;

            // ── Idempotent Pending State ──────────────────────────────────
            // If a pending secret exists (not yet verified) and is fresh (< 30 min), reuse it unless forced
            bool hasFreshPending = !force
                && !user.IsTwoFactorEnabled
                && !string.IsNullOrEmpty(user.TwoFactorSecret)
                && user.TwoFactorPendingAt.HasValue
                && (DateTime.UtcNow - user.TwoFactorPendingAt.Value).TotalMinutes < 30;

            if (hasFreshPending)
            {
                secret = user.TwoFactorSecret!;
                // Cannot reverse BCrypt hashes — return empty list with reuse flag
                backupCodes = new List<string>();
                isPendingReuse = true;
            }
            else
            {
                // Generate fresh 20-character Base32 secret for setup
                secret = TotpHelper.GenerateSecretKey(20);

                // Generate 8 one-time alphanumeric backup codes
                backupCodes = new List<string>();
                var hashedCodes = new List<string>();
                for (int i = 0; i < 8; i++)
                {
                    var code = TotpHelper.GenerateBackupCode();
                    backupCodes.Add(code);
                    hashedCodes.Add(BCrypt.Net.BCrypt.HashPassword(code, 10));
                }

                // Store pending secret and backup codes (IsTwoFactorEnabled remains false until verified)
                user.TwoFactorSecret = secret;
                user.TwoFactorBackupCodes = JsonSerializer.Serialize(hashedCodes);
                user.TwoFactorPendingAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            var issuer = Uri.EscapeDataString("LegalConnect");
            var email = Uri.EscapeDataString(user.Email);
            var totpUri = $"otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}&digits=6&period=30&algorithm=SHA1";
            var qrCodeUrl = GenerateQrCodeDataUrl(totpUri);

            return new TwoFactorSetupResponseDto
            {
                Secret = secret,
                QrCodeUrl = qrCodeUrl,
                QrUri = totpUri,
                BackupCodes = backupCodes,
                IsPendingReuse = isPendingReuse
            };
        }

        public async Task<(bool success, string message, bool isTwoFactorEnabled)> Toggle2FaAsync(int userId, Toggle2FaDto request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found.", false);

            if (request.Enable)
            {
                // ── Zero-Downtime Reconfiguration Verification ──────────
                // Check if user is verifying a pending reconfiguration session
                if (_cache.TryGetValue<PendingReconfigureSession>($"2fa_reconfigure_{userId}", out var pendingReconfigure) && pendingReconfigure != null)
                {
                    if (!TotpHelper.ValidateCode(pendingReconfigure.Secret, request.Code))
                    {
                        return (false, "Invalid verification code from your new authenticator app. Please try again.", true);
                    }

                    // Verification succeeded! Now atomically promote pending secret to active
                    user.TwoFactorSecret = pendingReconfigure.Secret;
                    user.TwoFactorBackupCodes = JsonSerializer.Serialize(pendingReconfigure.HashedBackupCodes);
                    user.IsTwoFactorEnabled = true;
                    user.TwoFactorPendingAt = null;

                    _cache.Remove($"2fa_reconfigure_{userId}");
                    await _context.SaveChangesAsync();

                    return (true, "Authenticator successfully reconfigured! Your replacement device is now active.", true);
                }

                // ── Standard Initial 2FA Setup Verification ─────────────
                if (string.IsNullOrEmpty(user.TwoFactorSecret))
                {
                    return (false, "2FA setup has not been initialized. Please scan the QR code first.", false);
                }
                if (!TotpHelper.ValidateCode(user.TwoFactorSecret, request.Code))
                {
                    return (false, "Invalid verification code. Please check your authenticator app and try again.", false);
                }
                user.IsTwoFactorEnabled = true;
                user.TwoFactorPendingAt = null;
            }
            else
            {
                // If user was already enabled and password provided, verify password
                if (user.IsTwoFactorEnabled && !string.IsNullOrEmpty(request.Password))
                {
                    bool isValid = VerifyUserPassword(user, request.Password);
                    if (!isValid)
                    {
                        return (false, "Incorrect password. Please enter your valid account password to disable 2FA.", true);
                    }
                }
                user.IsTwoFactorEnabled = false;
                user.TwoFactorSecret = null;
                user.TwoFactorBackupCodes = null;
                user.TwoFactorPendingAt = null;
                _cache.Remove($"2fa_reconfigure_{userId}");
            }

            await _context.SaveChangesAsync();
            var msg = user.IsTwoFactorEnabled ? "2FA activated successfully!" : "2FA deactivated successfully!";
            return (true, msg, user.IsTwoFactorEnabled);
        }

        // ── 2FA Reconfigure & Backup Code Management ─────────────────────

        /// <summary>
        /// Verifies a user's password against the stored hash.
        /// If a legacy plaintext password is detected, it is auto-migrated to BCrypt on match.
        /// Caller MUST call SaveChangesAsync after this method if the hash was migrated.
        /// </summary>
        private bool VerifyUserPassword(User user, string password)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(user.PasswordHash)) return false;

            // BCrypt hash verification (primary path)
            if (user.PasswordHash.StartsWith("$2a$") || user.PasswordHash.StartsWith("$2b$") || user.PasswordHash.StartsWith("$2y$"))
            {
                return BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
            }

            // Legacy plaintext match → auto-migrate to BCrypt on success
            if (user.PasswordHash == password)
            {
                _logger.LogWarning("[Security] Auto-migrating plaintext password to BCrypt for UserId {UserId}. This indicates a legacy or seeded account.", user.Id);
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
                return true;
            }

            return false;
        }

        public async Task<TwoFactorSetupResponseDto?> Reconfigure2FaAsync(int userId, string password)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null || !user.IsTwoFactorEnabled) return null;
            if (!VerifyUserPassword(user, password)) return null;

            // Generate a fresh TOTP secret for the replacement device
            var secret = TotpHelper.GenerateSecretKey(20);

            // Generate 8 fresh backup codes
            var backupCodes = new List<string>();
            var hashedCodes = new List<string>();
            for (int i = 0; i < 8; i++)
            {
                var code = TotpHelper.GenerateBackupCode();
                backupCodes.Add(code);
                hashedCodes.Add(BCrypt.Net.BCrypt.HashPassword(code, 10));
            }

            // ZERO-DOWNTIME / ZERO-LOCKOUT PROTECTION:
            // Do NOT overwrite user.TwoFactorSecret or backup codes in the database yet!
            // Storing in a 15-minute sliding memory cache guarantees that if the user cancels,
            // loses connection, or enters an invalid code, their existing authenticator remains 100% active.
            var pendingSession = new PendingReconfigureSession
            {
                Secret = secret,
                HashedBackupCodes = hashedCodes,
                CreatedAt = DateTime.UtcNow
            };
            _cache.Set($"2fa_reconfigure_{userId}", pendingSession, TimeSpan.FromMinutes(15));

            var issuer = Uri.EscapeDataString("LegalConnect");
            var email = Uri.EscapeDataString(user.Email);
            var totpUri = $"otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}&digits=6&period=30&algorithm=SHA1";
            var qrCodeUrl = GenerateQrCodeDataUrl(totpUri);

            return new TwoFactorSetupResponseDto
            {
                Secret = secret,
                QrCodeUrl = qrCodeUrl,
                QrUri = totpUri,
                BackupCodes = backupCodes,
                IsReconfiguring = true,
                Message = "New authenticator key generated. Please scan the QR code and enter the 6-digit confirmation code."
            };
        }

        public bool CancelReconfigure2Fa(int userId)
        {
            _cache.Remove($"2fa_reconfigure_{userId}");
            return true;
        }

        public async Task<BackupCodesResponseDto?> GetBackupCodesAsync(int userId, string password)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null || !user.IsTwoFactorEnabled) return null;
            if (!VerifyUserPassword(user, password)) return null;

            // Count remaining backup codes (hashed, cannot be reversed)
            int remaining = 0;
            if (!string.IsNullOrEmpty(user.TwoFactorBackupCodes))
            {
                try
                {
                    var codes = JsonSerializer.Deserialize<List<string>>(user.TwoFactorBackupCodes);
                    remaining = codes?.Count ?? 0;
                }
                catch { remaining = 0; }
            }

            return new BackupCodesResponseDto
            {
                Remaining = remaining,
                Total = 8,
                Message = $"{remaining} of 8 backup codes remaining."
            };
        }

        public async Task<BackupCodesResponseDto?> RegenerateBackupCodesAsync(int userId, string password)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null || !user.IsTwoFactorEnabled) return null;
            if (!VerifyUserPassword(user, password)) return null;

            // Generate 8 fresh one-time backup codes
            var backupCodes = new List<string>();
            var hashedCodes = new List<string>();
            for (int i = 0; i < 8; i++)
            {
                var code = TotpHelper.GenerateBackupCode();
                backupCodes.Add(code);
                hashedCodes.Add(BCrypt.Net.BCrypt.HashPassword(code, 10));
            }

            user.TwoFactorBackupCodes = JsonSerializer.Serialize(hashedCodes);
            await _context.SaveChangesAsync();

            return new BackupCodesResponseDto
            {
                BackupCodes = backupCodes,
                Total = 8,
                Remaining = 8,
                Message = "8 new backup codes generated. Previous codes have been invalidated."
            };
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
                PublicId = user.PublicId,
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
                ClientState = user.ClientState,
                ClientBio = user.ClientBio,
                AvatarUrl = user.AvatarUrl,
                DateOfBirth = user.DateOfBirth,
                Gender = user.Gender,
                NotifyWhatsAppEnabled = user.NotifyWhatsAppEnabled,
                WhatsAppPhone = user.WhatsAppPhone,
                IsSearchIndexable = user.IsSearchIndexable
            };
        }

        private async Task<string?> SaveBase64FileAsync(string? base64Data, string subfolder, string fileNamePrefix)
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
                await File.WriteAllBytesAsync(filePath, bytes);

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
        
        private static string GenerateQrCodeDataUrl(string totpUri)
        {
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(totpUri, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            byte[] qrCodeBytes = qrCode.GetGraphic(20);
            return $"data:image/png;base64,{Convert.ToBase64String(qrCodeBytes)}";
        }
    }
}