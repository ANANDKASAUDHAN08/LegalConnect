using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;
        private readonly ITokenService _tokenService;
        private readonly ILogger<AuthService> _logger;

        public AuthService(
            AppDbContext context,
            IConfiguration configuration,
            IEmailService emailService,
            ITokenService tokenService,
            ILogger<AuthService> logger)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
            _tokenService = tokenService;
            _logger = logger;
        }

        public async Task<(bool isSuccess, string message, User? user)> RegisterAsync(RegisterDto request, string? ipAddress)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                _logger.LogWarning("[Security Audit] Registration failed: Email already exists. Email: {Email}, IP: {IP}", request.Email, ipAddress);
                return (false, "User with this email already exists.", null);
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

            _logger.LogInformation("[Security Audit] User registered successfully. UserId: {UserId}, Email: {Email}, Role: {Role}, IP: {IP}", user.Id, user.Email, user.Role, ipAddress);

            if (user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
            {
                var lawyerProfile = new LawyerProfile
                {
                    UserId = user.Id,
                    BarCouncilNumber = "PENDING",
                    Specialization = "General Practice",
                    ExperienceYears = 0,
                    IsVerified = false,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.LawyerProfiles.Add(lawyerProfile);
                await _context.SaveChangesAsync();
            }

            if (requireVerification)
            {
                await _emailService.SendVerificationEmailAsync(user.Email, emailToken);
                return (true, "User registered successfully! Please check your email to verify your account.", user);
            }

            return (true, "User registered successfully! You can now sign in.", user);
        }

        public async Task<(bool isSuccess, string message, User? user, string? sessionId)> RegisterAndLoginAsync(RegisterDto request, string? ipAddress, string? userAgent)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                _logger.LogWarning("[Security Audit] Registration failed: Email already exists. Email: {Email}, IP: {IP}", request.Email, ipAddress);
                return (false, "User with this email already exists.", null, null);
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
                    IsVerified = false,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.LawyerProfiles.Add(lawyerProfile);
            }

            if (requireVerification)
            {
                await _context.SaveChangesAsync();
                await _emailService.SendVerificationEmailAsync(user.Email, emailToken);
                return (true, "User registered successfully! Please check your email to verify your account.", user, null);
            }

            var sessionId = Guid.NewGuid().ToString("N");
            _context.ActiveSessions.Add(new ActiveSession
            {
                UserId = user.Id,
                TokenId = sessionId,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                CreatedAt = DateTime.UtcNow,
                LastActive = DateTime.UtcNow
            });

            _context.LoginHistories.Add(new LoginHistory
            {
                UserId = user.Id,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                LoginTime = DateTime.UtcNow,
                Status = "Success"
            });

            var (_, refreshEntity) = _tokenService.GenerateRefreshToken(user.Id, sessionId);
            _context.RefreshTokens.Add(refreshEntity);

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Atomic registration & session creation succeeded. UserId: {UserId}, Email: {Email}, SessionId: {SessionId}", user.Id, user.Email, sessionId);
            return (true, "Registered and authenticated successfully!", user, sessionId);
        }

        public async Task<(bool isSuccess, string message, bool requires2fa, User? user, string? sessionId)> LoginAsync(LoginDto request, string? ipAddress, string? userAgent)
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
                    // Security: Never compare plaintext passwords. Log for admin remediation.
                    _logger.LogWarning("[Security Audit] User {UserId} ({Email}) has an unhashed password. Denying login until password is migrated.", user.Id, user.Email);
                    isPasswordValid = false;
                }
            }

            if (user == null || !isPasswordValid)
            {
                _logger.LogWarning("[Security Audit] Failed login attempt for Email: {Email}, IP: {IP}, UserAgent: {UserAgent}", request.Email, ipAddress, userAgent);
                if (user != null)
                {
                    _context.LoginHistories.Add(new LoginHistory
                    {
                        UserId = user.Id,
                        IpAddress = ipAddress,
                        UserAgent = userAgent,
                        LoginTime = DateTime.UtcNow,
                        Status = "Failed"
                    });
                    await _context.SaveChangesAsync();
                }
                return (false, "Invalid credentials.", false, null, null);
            }

            if (user.IsTwoFactorEnabled)
            {
                if (string.IsNullOrEmpty(request.TwoFactorCode))
                {
                    return (false, "2FA verification required.", true, null, null);
                }
                if (string.IsNullOrEmpty(user.TwoFactorSecret) || !TotpHelper.ValidateCode(user.TwoFactorSecret, request.TwoFactorCode))
                {
                    _logger.LogWarning("[Security Audit] Failed 2FA verification attempt for UserId: {UserId}, Email: {Email}, IP: {IP}", user.Id, user.Email, ipAddress);
                    _context.LoginHistories.Add(new LoginHistory
                    {
                        UserId = user.Id,
                        IpAddress = ipAddress,
                        UserAgent = userAgent,
                        LoginTime = DateTime.UtcNow,
                        Status = "Failed"
                    });
                    await _context.SaveChangesAsync();
                    return (false, "Invalid 2FA verification code.", false, null, null);
                }
            }

            var requireVerification = _configuration.GetValue<bool>("Auth:RequireEmailVerification");
            if (requireVerification && !user.IsEmailVerified)
            {
                _logger.LogWarning("[Security Audit] Login blocked for unverified email. UserId: {UserId}, Email: {Email}", user.Id, user.Email);
                return (false, "Please verify your email address before signing in.", false, null, null);
            }

            var sessionId = Guid.NewGuid().ToString("N");

            _context.ActiveSessions.Add(new ActiveSession
            {
                UserId = user.Id,
                TokenId = sessionId,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                CreatedAt = DateTime.UtcNow,
                LastActive = DateTime.UtcNow
            });

            _context.LoginHistories.Add(new LoginHistory
            {
                UserId = user.Id,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                LoginTime = DateTime.UtcNow,
                Status = "Success"
            });

            var (_, refreshEntity) = _tokenService.GenerateRefreshToken(user.Id, sessionId);
            _context.RefreshTokens.Add(refreshEntity);

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Successful login. UserId: {UserId}, Email: {Email}, SessionId: {SessionId}, IP: {IP}", user.Id, user.Email, sessionId, ipAddress);
            return (true, "Logged in successfully!", false, user, sessionId);
        }

        public async Task<(bool isSuccess, string message, User? user, string? sessionId)> GoogleLoginAsync(GoogleLoginDto request, string? ipAddress, string? userAgent)
        {
            if (string.IsNullOrWhiteSpace(request?.Credential))
            {
                return (false, "Google ID token is required.", null, null);
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                var validationSettings = new GoogleJsonWebSignature.ValidationSettings();
                var configuredClientId = _configuration["Google:ClientId"];
                if (!string.IsNullOrWhiteSpace(configuredClientId))
                {
                    validationSettings.Audience = new[] { configuredClientId };
                }

                payload = await GoogleJsonWebSignature.ValidateAsync(request.Credential, validationSettings);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Security Audit] Google token validation failed from IP: {IP}", ipAddress);
                return (false, "Invalid or expired Google authentication token.", null, null);
            }

            if (string.IsNullOrWhiteSpace(payload.Email))
            {
                return (false, "Google account email could not be verified.", null, null);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject || u.Email == payload.Email);
            if (user == null)
            {
                var desiredRole = (request.Role?.Equals("Lawyer", StringComparison.OrdinalIgnoreCase) == true) ? "Lawyer" : "Client";
                user = new User
                {
                    FullName = payload.Name ?? payload.Email.Split('@')[0],
                    Email = payload.Email,
                    GoogleId = payload.Subject,
                    AuthProvider = "Google",
                    IsEmailVerified = true,
                    AvatarUrl = payload.Picture,
                    Role = desiredRole,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                    CreatedAt = DateTime.UtcNow
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                _logger.LogInformation("[Security Audit] Created new user via Google Auth. UserId: {UserId}, Email: {Email}, Role: {Role}", user.Id, user.Email, user.Role);

                if (user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
                {
                    _context.LawyerProfiles.Add(new LawyerProfile
                    {
                        UserId = user.Id,
                        BarCouncilNumber = "PENDING",
                        Specialization = "General Practice",
                        ExperienceYears = 0,
                        IsVerified = false,
                        UpdatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                }
            }
            else
            {
                bool modified = false;
                if (string.IsNullOrEmpty(user.GoogleId))
                {
                    user.GoogleId = payload.Subject;
                    user.AuthProvider = "Google + Email";
                    modified = true;
                }
                if (!user.IsEmailVerified)
                {
                    user.IsEmailVerified = true;
                    user.EmailVerificationToken = null;
                    modified = true;
                }
                if (string.IsNullOrEmpty(user.AvatarUrl) && !string.IsNullOrEmpty(payload.Picture))
                {
                    user.AvatarUrl = payload.Picture;
                    modified = true;
                }
                if (modified)
                {
                    await _context.SaveChangesAsync();
                }
            }

            if (!user.IsActive)
            {
                return (false, "Your account has been deactivated. Please contact support.", null, null);
            }

            var sessionId = Guid.NewGuid().ToString("N");
            _context.ActiveSessions.Add(new ActiveSession
            {
                UserId = user.Id,
                TokenId = sessionId,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                CreatedAt = DateTime.UtcNow,
                LastActive = DateTime.UtcNow
            });

            _context.LoginHistories.Add(new LoginHistory
            {
                UserId = user.Id,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                LoginTime = DateTime.UtcNow,
                Status = "Success (Google OAuth)"
            });

            var (_, refreshEntity) = _tokenService.GenerateRefreshToken(user.Id, sessionId);
            _context.RefreshTokens.Add(refreshEntity);

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Successful Google login. UserId: {UserId}, Email: {Email}, SessionId: {SessionId}", user.Id, user.Email, sessionId);
            return (true, "Logged in with Google successfully!", user, sessionId);
        }

        public async Task<(bool isSuccess, string message, string? accessToken, string? newRawRefreshToken)> RefreshTokenAsync(string rawRefreshToken, string? ipAddress, string? userAgent)
        {
            if (string.IsNullOrEmpty(rawRefreshToken))
            {
                return (false, "No refresh token provided.", null, null);
            }

            string hashedToken;
            try
            {
                hashedToken = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawRefreshToken)));
            }
            catch
            {
                return (false, "Invalid refresh token format.", null, null);
            }

            var storedToken = await _context.RefreshTokens
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Token == hashedToken);

            if (storedToken == null)
            {
                return (false, "Invalid refresh token.", null, null);
            }

            if (storedToken.RevokedAt != null)
            {
                if (storedToken.RevokedAt.Value.AddSeconds(30) > DateTime.UtcNow)
                {
                    // Grace period
                }
                else
                {
                    await RevokeAllUserRefreshTokensAsync(storedToken.UserId, $"REPLAY:{ipAddress}");
                    return (false, "Token reuse detected. All sessions revoked.", null, null);
                }
            }

            if (storedToken.ExpiresAt <= DateTime.UtcNow)
            {
                return (false, "Refresh token expired. Please log in again.", null, null);
            }

            var user = storedToken.User;
            if (user == null)
            {
                return (false, "User not found.", null, null);
            }

            storedToken.RevokedAt = DateTime.UtcNow;
            storedToken.RevokedByIp = ipAddress;

            var (newRawRefresh, newRefreshEntity) = _tokenService.GenerateRefreshToken(user.Id, storedToken.SessionId);
            storedToken.ReplacedByToken = newRefreshEntity.Token;
            _context.RefreshTokens.Add(newRefreshEntity);

            var session = await _context.ActiveSessions.FirstOrDefaultAsync(s => s.TokenId == storedToken.SessionId);
            if (session != null)
            {
                session.LastActive = DateTime.UtcNow;
                session.IpAddress = ipAddress;
            }
            else
            {
                _context.ActiveSessions.Add(new ActiveSession
                {
                    UserId = user.Id,
                    TokenId = storedToken.SessionId,
                    IpAddress = ipAddress,
                    UserAgent = userAgent ?? "Mobile Device",
                    CreatedAt = DateTime.UtcNow,
                    LastActive = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            var newAccessToken = _tokenService.CreateAccessToken(user, storedToken.SessionId);
            return (true, "Token refreshed successfully!", newAccessToken, newRawRefresh);
        }

        public async Task LogoutAsync(string? sessionIdClaim, string? userIdClaim, string? ipAddress)
        {
            if (!string.IsNullOrEmpty(sessionIdClaim))
            {
                var session = await _context.ActiveSessions.FirstOrDefaultAsync(s => s.TokenId == sessionIdClaim);
                if (session != null)
                {
                    _context.ActiveSessions.Remove(session);
                }

                var refreshTokens = await _context.RefreshTokens
                    .Where(r => r.SessionId == sessionIdClaim && r.RevokedAt == null)
                    .ToListAsync();
                foreach (var rt in refreshTokens)
                {
                    rt.RevokedAt = DateTime.UtcNow;
                    rt.RevokedByIp = ipAddress;
                }
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("[Security Audit] User logged out. UserId: {UserId}, SessionId: {SessionId}, IP: {IP}", userIdClaim ?? "Unknown", sessionIdClaim ?? "N/A", ipAddress);
        }

        public async Task<bool> ForgotPasswordAsync(ForgotPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null) return false;

            var resetToken = Guid.NewGuid().ToString("N");
            user.PasswordResetToken = resetToken;
            user.PasswordResetTokenExpires = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            await _emailService.SendPasswordResetEmailAsync(user.Email, resetToken);
            return true;
        }

        public async Task<(bool isSuccess, string message)> ResetPasswordAsync(ResetPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.Email == request.Email &&
                u.PasswordResetToken == request.Token &&
                u.PasswordResetTokenExpires > DateTime.UtcNow);

            if (user == null)
            {
                return (false, "Invalid or expired password reset link.");
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpires = null;
            await _context.SaveChangesAsync();

            return (true, "Password has been reset successfully! You can now log in.");
        }

        private async Task RevokeAllUserRefreshTokensAsync(int userId, string reason)
        {
            var tokens = await _context.RefreshTokens
                .Where(r => r.UserId == userId && r.RevokedAt == null)
                .ToListAsync();
            foreach (var t in tokens)
            {
                t.RevokedAt = DateTime.UtcNow;
                t.RevokedByIp = reason;
            }
            await _context.SaveChangesAsync();
        }
    }
}