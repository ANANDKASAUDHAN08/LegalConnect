using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    public partial class AdminController : ControllerBase
    {
        // ═══════════════════════════════════════════════════════════════
        //  ADMIN AUTHENTICATION
        // ═══════════════════════════════════════════════════════════════

        [HttpPost("login")]
        public async Task<IActionResult> AdminLogin([FromBody] LoginDto request)
        {
            var emailInput = (request.Email ?? "").Trim().ToLower();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == emailInput);

            bool isPasswordValid = false;
            if (user != null && !string.IsNullOrEmpty(user.PasswordHash))
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

            string? ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            string? userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : null;

            if (user == null || !isPasswordValid)
            {
                _logger.LogWarning("[Security Audit] Failed admin login attempt for Email: {Email}, IP: {IP}, UserAgent: {UserAgent}", request.Email, ip, userAgent);
                if (user != null)
                {
                    _context.LoginHistories.Add(new LoginHistory
                    {
                        UserId = user.Id,
                        IpAddress = ip,
                        UserAgent = userAgent,
                        LoginTime = DateTime.UtcNow,
                        Status = "Failed"
                    });
                    await _context.SaveChangesAsync();
                }
                return Unauthorized(new { message = "Invalid credentials." });
            }

            // ADMIN-ONLY CHECK — reject non-admin users
            if (user.Role != "Admin")
            {
                _logger.LogWarning("[Security Audit] Unauthorized non-admin user attempted admin login. UserId: {UserId}, Email: {Email}, IP: {IP}", user.Id, user.Email, ip);
                _context.LoginHistories.Add(new LoginHistory
                {
                    UserId = user.Id,
                    IpAddress = ip,
                    UserAgent = userAgent,
                    LoginTime = DateTime.UtcNow,
                    Status = "Failed"
                });
                await _context.SaveChangesAsync();
                return Unauthorized(new { message = "Access denied. Admin credentials required." });
            }

            if (!user.IsActive)
            {
                _logger.LogWarning("[Security Audit] Deactivated admin user attempted login. UserId: {UserId}, Email: {Email}", user.Id, user.Email);
                return Unauthorized(new { message = "This account has been deactivated." });
            }

            // 2FA check for admin (supports TOTP codes and one-time backup codes)
            if (user.IsTwoFactorEnabled)
            {
                if (string.IsNullOrEmpty(request.TwoFactorCode))
                {
                    return Ok(new { requires2fa = true, message = "2FA verification required." });
                }

                bool is2FaValid = false;

                // First try TOTP validation
                if (!string.IsNullOrEmpty(user.TwoFactorSecret))
                {
                    is2FaValid = TotpHelper.ValidateCode(user.TwoFactorSecret, request.TwoFactorCode);
                }

                // If TOTP failed, try backup code validation
                if (!is2FaValid && !string.IsNullOrEmpty(user.TwoFactorBackupCodes))
                {
                    try
                    {
                        var hashedCodes = JsonSerializer.Deserialize<List<string>>(user.TwoFactorBackupCodes) ?? new List<string>();
                        var normalizedInput = request.TwoFactorCode.Trim().ToUpperInvariant();
                        int matchIndex = -1;
                        for (int i = 0; i < hashedCodes.Count; i++)
                        {
                            if (BCrypt.Net.BCrypt.Verify(normalizedInput, hashedCodes[i]))
                            {
                                matchIndex = i;
                                break;
                            }
                        }
                        if (matchIndex >= 0)
                        {
                            // Consume the used backup code
                            hashedCodes.RemoveAt(matchIndex);
                            user.TwoFactorBackupCodes = JsonSerializer.Serialize(hashedCodes);
                            await _context.SaveChangesAsync();
                            is2FaValid = true;
                            _logger.LogWarning("[Security Audit] Admin (Id: {UserId}) used a backup code for 2FA login. Remaining: {Count}", user.Id, hashedCodes.Count);
                        }
                    }
                    catch { /* Corrupted backup codes — ignore and fail */ }
                }

                if (!is2FaValid)
                {
                    _logger.LogWarning("[Security Audit] Admin 2FA verification failed for UserId: {UserId}, Email: {Email}, IP: {IP}", user.Id, user.Email, ip);
                    _context.LoginHistories.Add(new LoginHistory
                    {
                        UserId = user.Id,
                        IpAddress = ip,
                        UserAgent = userAgent,
                        LoginTime = DateTime.UtcNow,
                        Status = "Failed"
                    });
                    await _context.SaveChangesAsync();
                    return BadRequest(new { message = "Invalid 2FA verification code or backup code." });
                }
            }

            // Update user's last login metrics
            user.LastLoginAt = DateTime.UtcNow;
            user.LastIpAddress = ip;

            // Create session
            var sessionId = Guid.NewGuid().ToString("N");
            _context.ActiveSessions.Add(new ActiveSession
            {
                UserId = user.Id,
                TokenId = sessionId,
                IpAddress = ip,
                UserAgent = userAgent,
                CreatedAt = DateTime.UtcNow,
                LastActive = DateTime.UtcNow
            });

            _context.LoginHistories.Add(new LoginHistory
            {
                UserId = user.Id,
                IpAddress = ip,
                UserAgent = userAgent,
                LoginTime = DateTime.UtcNow,
                Status = "Success"
            });

            await _context.SaveChangesAsync();

            var token = CreateAdminToken(user, sessionId);
            _logger.LogInformation("[Security Audit] Successful Admin Login. AdminId: {AdminId}, Email: {Email}, SessionId: {SessionId}, IP: {IP}", user.Id, user.Email, sessionId, ip);

            // Set cookie for admin panel
            var isSecure = HttpContext.Request.IsHttps || !_env.IsDevelopment();
            Response.Cookies.Append("lc_admin_token", token, new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = SameSiteMode.Lax,
                Expires = DateTime.UtcNow.AddHours(4),
                Path = "/"
            });

            return Ok(new
            {
                token,
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Role,
                    user.AvatarUrl
                },
                message = "Admin login successful."
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("logout")]
        public async Task<IActionResult> AdminLogout()
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
            Response.Cookies.Delete("lc_admin_token", new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = SameSiteMode.Lax,
                Path = "/"
            });

            return Ok(new { message = "Admin logged out." });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("me")]
        public async Task<IActionResult> GetAdminProfile()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // Count remaining backup codes for display
            int backupCodeCount = 0;
            if (!string.IsNullOrEmpty(user.TwoFactorBackupCodes))
            {
                try { backupCodeCount = JsonSerializer.Deserialize<List<string>>(user.TwoFactorBackupCodes)?.Count ?? 0; } catch { }
            }

            // Fallback resolution for LastLoginAt and LastIpAddress if null on user record
            var lastLoginAt = user.LastLoginAt;
            var lastIpAddress = user.LastIpAddress;

            if (lastLoginAt == null || string.IsNullOrEmpty(lastIpAddress))
            {
                var lastHistory = await _context.LoginHistories
                    .AsNoTracking()
                    .Where(l => l.UserId == user.Id && l.Status == "Success")
                    .OrderByDescending(l => l.LoginTime)
                    .FirstOrDefaultAsync();

                if (lastHistory != null)
                {
                    lastLoginAt ??= lastHistory.LoginTime;
                    lastIpAddress ??= lastHistory.IpAddress;
                }
                else
                {
                    var activeSession = await _context.ActiveSessions
                        .AsNoTracking()
                        .Where(s => s.UserId == user.Id)
                        .OrderByDescending(s => s.LastActive)
                        .FirstOrDefaultAsync();

                    if (activeSession != null)
                    {
                        lastLoginAt ??= activeSession.LastActive;
                        lastIpAddress ??= activeSession.IpAddress;
                    }
                }
            }

            return Ok(new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.Role,
                user.AvatarUrl,
                user.CreatedAt,
                user.IsTwoFactorEnabled,
                lastLoginAt,
                lastIpAddress = string.IsNullOrWhiteSpace(lastIpAddress) ? null : lastIpAddress,
                backupCodeCount
            });
        }
    }
}