using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.IO;
using Microsoft.AspNetCore.Hosting;
using Microsoft.IdentityModel.Tokens;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly IWebHostEnvironment _env;
        private readonly ILawyerSyncService _syncService;

        public AuthController(AppDbContext context, IConfiguration configuration, IEmailService emailService, IWebHostEnvironment env, ILawyerSyncService syncService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
            _env = env;
            _syncService = syncService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                return BadRequest("User with this email already exists.");
            }

            var requireVerification = _configuration.GetValue<bool>("Auth:RequireEmailVerification");
            var emailToken = Guid.NewGuid().ToString("N");

            var user = new User
            {
                FullName = request.FullName,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                CreatedAt = DateTime.UtcNow,
                IsEmailVerified = !requireVerification,
                EmailVerificationToken = requireVerification ? emailToken : null
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            if (user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
            {
                var lawyerProfile = new LawyerProfile
                {
                    UserId = user.Id,
                    BarCouncilNumber = "PENDING",
                    Specialization = "General Practice",
                    ExperienceYears = 0,
                    IsVerified = true,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.LawyerProfiles.Add(lawyerProfile);
                await _context.SaveChangesAsync();
            }

            if (requireVerification)
            {
                await _emailService.SendVerificationEmailAsync(user.Email, emailToken);
                return Ok(new { message = "User registered successfully! Please check your email to verify your account." });
            }

            return Ok(new { message = "User registered successfully! You can now sign in." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            
            bool isPasswordValid = false;
            if (user != null)
            {
                if (user.PasswordHash.StartsWith("$2a$") || user.PasswordHash.StartsWith("$2b$") || user.PasswordHash.StartsWith("$2y$")) 
                {
                    isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
                }
                else 
                {
                    isPasswordValid = (user.PasswordHash == request.Password);
                }
            }

            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown IP";
            var userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : "Unknown Device";
            if (string.IsNullOrWhiteSpace(userAgent)) userAgent = "Unknown Device";

            if (user == null || !isPasswordValid)
            {
                if (user != null)
                {
                    var failHistory = new LoginHistory
                    {
                        UserId = user.Id,
                        IpAddress = ip,
                        UserAgent = userAgent,
                        LoginTime = DateTime.UtcNow,
                        Status = "Failed"
                    };
                    _context.LoginHistories.Add(failHistory);
                    await _context.SaveChangesAsync();
                }
                return Unauthorized("Invalid credentials.");
            }

            if (user.IsTwoFactorEnabled)
            {
                if (string.IsNullOrEmpty(request.TwoFactorCode))
                {
                    return Ok(new { requires2fa = true, message = "2FA verification required." });
                }
                if (string.IsNullOrEmpty(user.TwoFactorSecret) || !TotpHelper.ValidateCode(user.TwoFactorSecret, request.TwoFactorCode))
                {
                    var failHistory = new LoginHistory
                    {
                        UserId = user.Id,
                        IpAddress = ip,
                        UserAgent = userAgent,
                        LoginTime = DateTime.UtcNow,
                        Status = "Failed"
                    };
                    _context.LoginHistories.Add(failHistory);
                    await _context.SaveChangesAsync();
                    return BadRequest("Invalid 2FA verification code.");
                }
            }

            var requireVerification = _configuration.GetValue<bool>("Auth:RequireEmailVerification");
            if (requireVerification && !user.IsEmailVerified)
            {
                return BadRequest("Please verify your email address before signing in.");
            }

            // Create unique SessionId
            var sessionId = Guid.NewGuid().ToString("N");

            // Register session
            var session = new ActiveSession
            {
                UserId = user.Id,
                TokenId = sessionId,
                IpAddress = ip,
                UserAgent = userAgent,
                CreatedAt = DateTime.UtcNow,
                LastActive = DateTime.UtcNow
            };
            _context.ActiveSessions.Add(session);

            // Register success login history
            var successHistory = new LoginHistory
            {
                UserId = user.Id,
                IpAddress = ip,
                UserAgent = userAgent,
                LoginTime = DateTime.UtcNow,
                Status = "Success"
            };
            _context.LoginHistories.Add(successHistory);

            await _context.SaveChangesAsync();

            var token = CreateToken(user, sessionId);
            SetTokenCookie(token);

            return Ok(new { token, message = "Logged in successfully!" });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var sessionIdClaim = User.FindFirst("SessionId")?.Value;
            if (!string.IsNullOrEmpty(sessionIdClaim))
            {
                var session = await _context.ActiveSessions.FirstOrDefaultAsync(s => s.TokenId == sessionIdClaim);
                if (session != null)
                {
                    _context.ActiveSessions.Remove(session);
                    await _context.SaveChangesAsync();
                }
            }

            var isSecure = HttpContext.Request.IsHttps || !_env.IsDevelopment();
            Response.Cookies.Delete("lc_token", new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = SameSiteMode.Lax
            });
            return Ok(new { message = "Logged out successfully." });
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail(string token, string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && u.EmailVerificationToken == token);
            if (user == null)
            {
                return BadRequest("Invalid or expired email verification link.");
            }

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Email verified successfully! You can now log in." });
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null)
            {
                // To prevent email enumeration, return a success message regardless of existence.
                return Ok(new { message = "If the email exists, a password reset link has been sent." });
            }

            var resetToken = Guid.NewGuid().ToString("N");
            user.PasswordResetToken = resetToken;
            user.PasswordResetTokenExpires = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            await _emailService.SendPasswordResetEmailAsync(user.Email, resetToken);

            return Ok(new { message = "If the email exists, a password reset link has been sent." });
        }

        [HttpPost("reset-password")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => 
                u.Email == request.Email && 
                u.PasswordResetToken == request.Token && 
                u.PasswordResetTokenExpires > DateTime.UtcNow);

            if (user == null)
            {
                return BadRequest("Invalid or expired password reset link.");
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpires = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password has been reset successfully! You can now log in." });
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetProfile()
        {
            var isAuthenticated = User.Identity?.IsAuthenticated ?? false;
            if (!isAuthenticated)
            {
                return Ok(new { isAuthenticated = false });
            }

            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Ok(new { isAuthenticated = false });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return Ok(new { isAuthenticated = false });

            // Extract the token from Request
            string? token = Request.Cookies["lc_token"];
            if (string.IsNullOrEmpty(token))
            {
                var authHeader = Request.Headers["Authorization"].ToString();
                if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    token = authHeader.Substring(7);
                }
            }

            return Ok(new
            {
                isAuthenticated = true,
                token = token,
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                role = user.Role,
                createdAt = user.CreatedAt,
                phone = user.Phone,
                isPhoneVerified = user.IsPhoneVerified,
                isEmailVerified = user.IsEmailVerified,
                isTwoFactorEnabled = user.IsTwoFactorEnabled,
                clientLanguage = user.ClientLanguage,
                clientCity = user.ClientCity,
                clientInterest = user.ClientInterest,
                dateOfBirth = user.DateOfBirth,
                gender = user.Gender,
                addressLine1 = user.AddressLine1,
                clientState = user.ClientState,
                clientZip = user.ClientZip,
                clientBio = user.ClientBio,
                avatarUrl = user.AvatarUrl,
                identityStatus = user.IdentityStatus,
                identityDocumentUrl = user.IdentityDocumentUrl
            });
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile(UpdateProfileDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

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

            await _context.SaveChangesAsync();

            if (user.Role != null && user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
            {
                await _syncService.SyncProfileToMongoAsync(user.Id);
            }

            return Ok(new { message = "Profile updated successfully!", fullName = user.FullName });
        }

        [Authorize]
        [HttpPut("change-password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            bool isCurrentValid = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash);
            if (!isCurrentValid) return BadRequest("Current password is incorrect.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password changed successfully!" });
        }

        [Authorize]
        [HttpDelete("me")]
        public async Task<IActionResult> DeleteAccount()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            Response.Cookies.Delete("lc_token", new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax
            });

            if (user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    using var httpClient = new System.Net.Http.HttpClient();
                    var nodeBaseUrl = _configuration["NodeServices:BaseUrl"] ?? "http://localhost:5000";
                    var nodeUrl = $"{nodeBaseUrl}/api/lawyers/sync/{user.Email}";
                    var response = await httpClient.DeleteAsync(nodeUrl);
                    if (!response.IsSuccessStatusCode)
                    {
                        Console.WriteLine($"Sync Delete Warning: Node.js responded with {response.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Sync Delete Error: {ex.Message}");
                }
            }

            return Ok(new { message = "Account deleted successfully." });
        }

        [Authorize]
        [HttpGet("2fa/setup")]
        public async Task<IActionResult> Get2FaSetup()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            // Generate secret if not exists
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

            return Ok(new
            {
                secret,
                qrCodeUrl
            });
        }

        [Authorize]
        [HttpPost("2fa/toggle")]
        public async Task<IActionResult> Toggle2Fa([FromBody] Toggle2FaDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            if (request.Enable)
            {
                if (string.IsNullOrEmpty(user.TwoFactorSecret))
                {
                    return BadRequest("2FA setup has not been initialized.");
                }
                if (!TotpHelper.ValidateCode(user.TwoFactorSecret, request.Code))
                {
                    return BadRequest("Invalid verification code. Please check your authenticator app.");
                }
                user.IsTwoFactorEnabled = true;
            }
            else
            {
                user.IsTwoFactorEnabled = false;
                user.TwoFactorSecret = null;
            }

            await _context.SaveChangesAsync();
            return Ok(new { isTwoFactorEnabled = user.IsTwoFactorEnabled, message = user.IsTwoFactorEnabled ? "2FA activated successfully!" : "2FA deactivated successfully!" });
        }

        [Authorize]
        [HttpPost("phone/verify")]
        public async Task<IActionResult> VerifyPhone([FromBody] VerifyPhoneDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            if (request.Code != "123456")
            {
                return BadRequest("Invalid OTP verification code. Please try again with code 123456.");
            }

            user.IsPhoneVerified = true;
            await _context.SaveChangesAsync();

            return Ok(new { isPhoneVerified = user.IsPhoneVerified, message = "Phone number verified successfully!" });
        }

        [Authorize]
        [HttpPost("verify-identity")]
        public async Task<IActionResult> VerifyIdentity([FromBody] VerifyIdentityDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            var fileUrl = SaveBase64File(request.DocumentFile, "documents", $"identity_user_{userId}");
            if (string.IsNullOrEmpty(fileUrl))
            {
                return BadRequest("Invalid document file.");
            }

            user.IdentityStatus = "Verified";
            user.IdentityDocumentUrl = fileUrl;
            await _context.SaveChangesAsync();

            return Ok(new 
            { 
                message = "Identity document uploaded and verified successfully!", 
                identityStatus = user.IdentityStatus,
                identityDocumentUrl = user.IdentityDocumentUrl
            });
        }

        [Authorize]
        [HttpGet("export-data")]
        public async Task<IActionResult> ExportData()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            var bookmarks = await _context.Bookmarks
                .Where(b => b.ClientId == userId)
                .ToListAsync();

            var consultations = await _context.Consultations
                .Where(c => c.ClientId == userId || c.LawyerId == userId)
                .ToListAsync();

            var reviews = await _context.Reviews
                .Where(r => r.UserId == userId)
                .ToListAsync();

            LawyerProfile? lawyerProfile = null;
            if (user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
            {
                lawyerProfile = await _context.LawyerProfiles.FirstOrDefaultAsync(lp => lp.UserId == userId);
                if (lawyerProfile == null)
                {
                    lawyerProfile = new LawyerProfile
                    {
                        UserId = userId,
                        BarCouncilNumber = "PENDING",
                        Specialization = "General Practice",
                        ExperienceYears = 0,
                        IsVerified = true,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.LawyerProfiles.Add(lawyerProfile);
                    await _context.SaveChangesAsync();
                }
            }

            var dataExport = new
            {
                exportedAt = DateTime.UtcNow,
                lawyerProfile = lawyerProfile == null ? null : new
                {
                    lawyerProfile.Id,
                    lawyerProfile.BarCouncilNumber,
                    lawyerProfile.Specialization,
                    lawyerProfile.ExperienceYears,
                    lawyerProfile.IsVerified,
                    lawyerProfile.City,
                    lawyerProfile.Bio,
                    lawyerProfile.Phone,
                    lawyerProfile.ConsultationFee,
                    lawyerProfile.OfficeAddress,
                    lawyerProfile.Education,
                    lawyerProfile.LanguagesSpoken,
                    lawyerProfile.IsAvailable,
                    lawyerProfile.UpdatedAt
                },
                profile = new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Role,
                    user.CreatedAt,
                    user.Phone,
                    user.IsPhoneVerified,
                    user.IsEmailVerified,
                    user.IsTwoFactorEnabled,
                    user.ClientLanguage,
                    user.ClientCity,
                    user.ClientInterest,
                    user.DateOfBirth,
                    user.Gender,
                    user.AddressLine1,
                    user.ClientState,
                    user.ClientZip,
                    user.ClientBio,
                    user.AvatarUrl,
                    user.IdentityStatus,
                    user.IdentityDocumentUrl
                },
                bookmarks = bookmarks.Select(b => new
                {
                    b.ActShortName,
                    b.ChapterNumber,
                    b.SectionNumber,
                    b.SectionTitle,
                    b.SectionContent,
                    b.SavedAt
                }),
                consultations = consultations.Select(c => new
                {
                    c.Id,
                    c.ClientName,
                    c.ClientEmail,
                    c.Message,
                    c.Status,
                    c.CreatedAt
                }),
                reviews = reviews.Select(r => new
                {
                    r.Id,
                    r.Rating,
                    r.Content,
                    r.TargetName,
                    r.CreatedAt
                })
            };

            var jsonString = System.Text.Json.JsonSerializer.Serialize(dataExport, new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
            });

            var bytes = System.Text.Encoding.UTF8.GetBytes(jsonString);
            return File(bytes, "application/json", "legalconnect_user_data_export.json");
        }

        [Authorize]
        [HttpPost("email/resend-verification")]
        public async Task<IActionResult> ResendEmailVerification()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            if (user.IsEmailVerified)
            {
                return BadRequest("Email is already verified.");
            }

            var emailToken = Guid.NewGuid().ToString("N");
            user.EmailVerificationToken = emailToken;
            await _context.SaveChangesAsync();

            await _emailService.SendVerificationEmailAsync(user.Email, emailToken);
            return Ok(new { message = "Verification email resent successfully! Please check your inbox." });
        }

        [Authorize]
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("User ID claim not found or invalid.");
            }

            var currentSessionId = User.FindFirst("SessionId")?.Value;

            var sessions = await _context.ActiveSessions
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.LastActive)
                .ToListAsync();

            var sessionDtos = new List<object>();
            foreach (var s in sessions)
            {
                sessionDtos.Add(new
                {
                    id = s.Id,
                    ipAddress = s.IpAddress,
                    userAgent = s.UserAgent,
                    deviceType = ParseDeviceFromUserAgent(s.UserAgent),
                    browser = ParseBrowserFromUserAgent(s.UserAgent),
                    location = GetLocationFromIp(s.IpAddress),
                    createdAt = s.CreatedAt,
                    lastActive = s.LastActive,
                    isCurrent = s.TokenId == currentSessionId
                });
            }

            return Ok(sessionDtos);
        }

        [Authorize]
        [HttpDelete("sessions/{id}")]
        public async Task<IActionResult> RevokeSession(int id)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("User ID claim not found or invalid.");
            }

            var session = await _context.ActiveSessions
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

            if (session == null)
            {
                return NotFound("Session not found or does not belong to you.");
            }

            _context.ActiveSessions.Remove(session);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Session revoked successfully." });
        }

        [Authorize]
        [HttpGet("login-history")]
        public async Task<IActionResult> GetLoginHistory()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("User ID claim not found or invalid.");
            }

            var historyList = await _context.LoginHistories
                .Where(h => h.UserId == userId)
                .OrderByDescending(h => h.LoginTime)
                .Take(20)
                .ToListAsync();

            var historyDtos = new List<object>();
            foreach (var h in historyList)
            {
                historyDtos.Add(new
                {
                    id = h.Id,
                    ipAddress = h.IpAddress,
                    userAgent = h.UserAgent,
                    deviceType = ParseDeviceFromUserAgent(h.UserAgent),
                    browser = ParseBrowserFromUserAgent(h.UserAgent),
                    location = GetLocationFromIp(h.IpAddress),
                    loginTime = h.LoginTime,
                    status = h.Status
                });
            }

            return Ok(historyDtos);
        }

        // ── Settings Endpoints ──────────────────────────────────────────────

        [Authorize]
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            return Ok(new UserSettingsDto
            {
                ClientLanguage      = user.ClientLanguage ?? "English",
                PreferredTimezone   = user.PreferredTimezone ?? "Asia/Kolkata",
                DateFormat          = user.DateFormat ?? "DD/MM/YYYY",
                NotifyLawAmendments = user.NotifyLawAmendments,
                NotifyEmailDigest   = user.NotifyEmailDigest,
                NotifyPushEnabled   = user.NotifyPushEnabled
            });
        }

        [Authorize]
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            if (request.ClientLanguage    != null) user.ClientLanguage    = request.ClientLanguage;
            if (request.PreferredTimezone != null) user.PreferredTimezone = request.PreferredTimezone;
            if (request.DateFormat        != null) user.DateFormat        = request.DateFormat;
            if (request.NotifyLawAmendments.HasValue) user.NotifyLawAmendments = request.NotifyLawAmendments.Value;
            if (request.NotifyEmailDigest.HasValue)   user.NotifyEmailDigest   = request.NotifyEmailDigest.Value;
            if (request.NotifyPushEnabled.HasValue)   user.NotifyPushEnabled   = request.NotifyPushEnabled.Value;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Settings saved successfully!" });
        }

        [Authorize]
        [HttpDelete("sessions/all")]
        public async Task<IActionResult> RevokeAllOtherSessions()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var currentSessionId = User.FindFirst("SessionId")?.Value;

            var otherSessions = await _context.ActiveSessions
                .Where(s => s.UserId == userId && s.TokenId != currentSessionId)
                .ToListAsync();

            _context.ActiveSessions.RemoveRange(otherSessions);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"{otherSessions.Count} other session(s) signed out successfully." });
        }

        private string ParseDeviceFromUserAgent(string userAgent)
        {
            if (string.IsNullOrEmpty(userAgent)) return "Unknown Device";
            if (userAgent.Contains("iPhone", StringComparison.OrdinalIgnoreCase)) return "Apple iPhone";
            if (userAgent.Contains("iPad", StringComparison.OrdinalIgnoreCase)) return "Apple iPad";
            if (userAgent.Contains("Android", StringComparison.OrdinalIgnoreCase)) return "Android Device";
            if (userAgent.Contains("Windows", StringComparison.OrdinalIgnoreCase)) return "Windows PC";
            if (userAgent.Contains("Macintosh", StringComparison.OrdinalIgnoreCase) || userAgent.Contains("Mac OS", StringComparison.OrdinalIgnoreCase)) return "Mac";
            if (userAgent.Contains("Linux", StringComparison.OrdinalIgnoreCase)) return "Linux PC";
            return "Web Browser";
        }

        private string ParseBrowserFromUserAgent(string userAgent)
        {
            if (string.IsNullOrEmpty(userAgent)) return "Unknown Browser";
            if (userAgent.Contains("Edg/", StringComparison.OrdinalIgnoreCase)) return "Microsoft Edge";
            if (userAgent.Contains("Chrome", StringComparison.OrdinalIgnoreCase)) return "Google Chrome";
            if (userAgent.Contains("Safari", StringComparison.OrdinalIgnoreCase)) return "Safari";
            if (userAgent.Contains("Firefox", StringComparison.OrdinalIgnoreCase)) return "Mozilla Firefox";
            return "Browser";
        }

        private string GetLocationFromIp(string ipAddress)
        {
            if (string.IsNullOrEmpty(ipAddress) || ipAddress == "::1" || ipAddress == "127.0.5.1" || ipAddress == "127.0.0.1")
            {
                return "New Delhi, India (Local)";
            }
            int hash = Math.Abs(ipAddress.GetHashCode());
            string[] locations = new[] {
                "Mumbai, India",
                "Bengaluru, India",
                "New York, USA",
                "London, UK",
                "San Francisco, USA",
                "New Delhi, India"
            };
            return locations[hash % locations.Length];
        }

        private void SetTokenCookie(string token)
        {
            var isSecure = HttpContext.Request.IsHttps || !_env.IsDevelopment();
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = SameSiteMode.Lax,
                Expires = DateTime.UtcNow.AddDays(1)
            };
            Response.Cookies.Append("lc_token", token, cookieOptions);
        }

        private string CreateToken(User user, string sessionId)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim("SessionId", sessionId)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                _configuration.GetSection("Jwt:Key").Value!));

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.Now.AddDays(1),
                signingCredentials: creds
            );

            var jwt = new JwtSecurityTokenHandler().WriteToken(token);

            return jwt;
        }

        private string? SaveBase64File(string? base64Data, string subfolder, string fileNamePrefix)
        {
            if (string.IsNullOrEmpty(base64Data))
            {
                return null;
            }

            if (base64Data.StartsWith("/") || base64Data.StartsWith("http") || !base64Data.Contains("base64,"))
            {
                return base64Data;
            }

            try
            {
                var parts = base64Data.Split("base64,");
                if (parts.Length < 2) return base64Data;

                var base64Content = parts[1];
                var bytes = Convert.FromBase64String(base64Content);

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
                System.IO.File.WriteAllBytes(filePath, bytes);

                return $"/uploads/{subfolder}/{fileName}";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error decoding base64 file: {ex.Message}");
                return base64Data;
            }
        }
    }
}
