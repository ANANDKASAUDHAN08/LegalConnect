using System;
using System.Security.Claims;
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
                return Unauthorized(new { message = "This account has been deactivated." });
            }

            // 2FA check for admin
            if (user.IsTwoFactorEnabled)
            {
                if (string.IsNullOrEmpty(request.TwoFactorCode))
                {
                    return Ok(new { requires2fa = true, message = "2FA verification required." });
                }
                if (string.IsNullOrEmpty(user.TwoFactorSecret) || !TotpHelper.ValidateCode(user.TwoFactorSecret, request.TwoFactorCode))
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
                    return BadRequest(new { message = "Invalid 2FA verification code." });
                }
            }

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

            return Ok(new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.Role,
                user.AvatarUrl,
                user.CreatedAt
            });
        }
    }
}