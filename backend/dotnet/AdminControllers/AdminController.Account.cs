using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CoreApi.DTOs.Admin;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    public partial class AdminController : ControllerBase
    {
        // ═══════════════════════════════════════════════════════════════
        //  ADMIN SELF-SERVICE ACCOUNT SECURITY
        // ═══════════════════════════════════════════════════════════════

        private static readonly Regex PasswordStrengthRegex = new Regex(
            @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$",
            RegexOptions.Compiled
        );

        // ─── Change Own Password ─────────────────────────────────────

        [Authorize(Roles = "Admin")]
        [HttpPut("account/password")]
        public async Task<IActionResult> ChangeOwnPassword([FromBody] AdminChangePasswordDto dto)
        {
            if (string.IsNullOrEmpty(dto.CurrentPassword) || string.IsNullOrEmpty(dto.NewPassword))
                return BadRequest(new { message = "Current password and new password are required." });

            if (!PasswordStrengthRegex.IsMatch(dto.NewPassword))
                return BadRequest(new { message = "Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 digit, and 1 special character." });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "Account not found." });

            // Verify current password
            bool isCurrentValid = false;
            if (user.PasswordHash.StartsWith("$2a$") || user.PasswordHash.StartsWith("$2b$") || user.PasswordHash.StartsWith("$2y$"))
            {
                isCurrentValid = BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash);
            }
            else
            {
                isCurrentValid = (user.PasswordHash == dto.CurrentPassword);
            }

            if (!isCurrentValid)
                return BadRequest(new { message = "Current password is incorrect." });

            // Ensure new password differs from current
            if (dto.CurrentPassword == dto.NewPassword)
                return BadRequest(new { message = "New password must be different from the current password." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword, 12);
            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Admin (Id: {AdminId}) successfully changed their password.", userId);

            return Ok(new { success = true, message = "Password changed successfully." });
        }

        // ─── 2FA Setup: Generate TOTP Secret + Backup Codes ──────────

        [Authorize(Roles = "Admin")]
        [HttpPost("account/2fa/setup")]
        public async Task<IActionResult> Setup2FA()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "Account not found." });

            if (user.IsTwoFactorEnabled)
                return BadRequest(new { message = "Two-factor authentication is already enabled on this account." });

            // Generate new TOTP secret
            var secret = TotpHelper.GenerateSecretKey(20);

            // Generate 8 one-time backup codes (8-char alphanumeric each)
            var backupCodes = new List<string>();
            var hashedCodes = new List<string>();
            for (int i = 0; i < 8; i++)
            {
                var code = GenerateBackupCode();
                backupCodes.Add(code);
                hashedCodes.Add(BCrypt.Net.BCrypt.HashPassword(code, 10));
            }

            // Store the secret temporarily (NOT enabled yet — user must verify first)
            user.TwoFactorSecret = secret;
            user.TwoFactorBackupCodes = JsonSerializer.Serialize(hashedCodes);
            await _context.SaveChangesAsync();

            // Build the otpauth provisioning URI for QR code generation
            var issuer = "LegalConnect Admin";
            var label = Uri.EscapeDataString($"{issuer}:{user.Email}");
            var qrUri = $"otpauth://totp/{label}?secret={secret}&issuer={Uri.EscapeDataString(issuer)}&digits=6&period=30&algorithm=SHA1";

            _logger.LogInformation("[Security Audit] Admin (Id: {AdminId}) initiated 2FA setup.", userId);

            return Ok(new
            {
                success = true,
                secret,
                qrUri,
                backupCodes,
                message = "Scan the QR code with your authenticator app, then verify with a code to activate 2FA."
            });
        }

        // ─── 2FA Verify: Confirm TOTP Code and Activate ──────────────

        [Authorize(Roles = "Admin")]
        [HttpPost("account/2fa/verify")]
        public async Task<IActionResult> Verify2FA([FromBody] AdminVerify2FADto dto)
        {
            if (string.IsNullOrEmpty(dto.Code))
                return BadRequest(new { message = "Verification code is required." });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "Account not found." });

            if (user.IsTwoFactorEnabled)
                return BadRequest(new { message = "2FA is already enabled." });

            if (string.IsNullOrEmpty(user.TwoFactorSecret))
                return BadRequest(new { message = "No 2FA setup found. Please initiate setup first." });

            // Validate the TOTP code against the pending secret
            if (!TotpHelper.ValidateCode(user.TwoFactorSecret, dto.Code))
                return BadRequest(new { message = "Invalid verification code. Please try again." });

            // Activate 2FA
            user.IsTwoFactorEnabled = true;
            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Admin (Id: {AdminId}) successfully activated 2FA.", userId);

            return Ok(new { success = true, message = "Two-factor authentication has been enabled." });
        }

        // ─── 2FA Disable: Requires Password Re-Verification ──────────

        [Authorize(Roles = "Admin")]
        [HttpPost("account/2fa/disable")]
        public async Task<IActionResult> Disable2FA([FromBody] AdminDisable2FADto dto)
        {
            if (string.IsNullOrEmpty(dto.Password))
                return BadRequest(new { message = "Password is required to disable 2FA." });

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "Account not found." });

            if (!user.IsTwoFactorEnabled)
                return BadRequest(new { message = "2FA is not currently enabled." });

            // Verify password
            bool isValid = false;
            if (user.PasswordHash.StartsWith("$2a$") || user.PasswordHash.StartsWith("$2b$") || user.PasswordHash.StartsWith("$2y$"))
            {
                isValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
            }
            else
            {
                isValid = (user.PasswordHash == dto.Password);
            }

            if (!isValid)
                return BadRequest(new { message = "Incorrect password." });

            user.IsTwoFactorEnabled = false;
            user.TwoFactorSecret = null;
            user.TwoFactorBackupCodes = null;
            await _context.SaveChangesAsync();

            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) DISABLED 2FA on their account.", userId);

            return Ok(new { success = true, message = "Two-factor authentication has been disabled." });
        }

        // ─── Own Sessions: List Admin's Active Sessions ──────────────

        [Authorize(Roles = "Admin")]
        [HttpGet("account/sessions")]
        public async Task<IActionResult> GetOwnSessions()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var currentSessionId = User.FindFirst("SessionId")?.Value;

            var sessions = await _context.ActiveSessions
                .AsNoTracking()
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.LastActive)
                .Select(s => new
                {
                    s.Id,
                    s.IpAddress,
                    s.UserAgent,
                    s.CreatedAt,
                    s.LastActive,
                    s.TokenId,
                    isCurrent = s.TokenId == currentSessionId
                })
                .ToListAsync();

            return Ok(new { success = true, data = sessions });
        }

        // ─── Own Session Revoke: Revoke One of Admin's Sessions ──────

        [Authorize(Roles = "Admin")]
        [HttpDelete("account/sessions/{id}")]
        public async Task<IActionResult> RevokeOwnSession(int id)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var currentSessionId = User.FindFirst("SessionId")?.Value;

            var session = await _context.ActiveSessions.FindAsync(id);
            if (session == null)
                return NotFound(new { message = "Session not found." });

            // Only allow revoking your own sessions
            if (session.UserId != userId)
                return Forbid();

            // Prevent self-lockout: cannot revoke current session
            if (session.TokenId == currentSessionId)
                return BadRequest(new { message = "Cannot revoke your current active session. Use logout instead." });

            _context.ActiveSessions.Remove(session);
            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Admin (Id: {AdminId}) revoked their own session Id: {SessionId}.", userId, id);

            return Ok(new { success = true, message = "Session revoked." });
        }

        // ─── Own Sessions Revoke Others: Revoke All Other Sessions ────────

        [Authorize(Roles = "Admin")]
        [HttpDelete("account/sessions/revoke-others")]
        public async Task<IActionResult> RevokeOtherSessions()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var currentSessionId = User.FindFirst("SessionId")?.Value;

            var otherSessions = await _context.ActiveSessions
                .Where(s => s.UserId == userId && s.TokenId != currentSessionId)
                .ToListAsync();

            if (otherSessions.Any())
            {
                _context.ActiveSessions.RemoveRange(otherSessions);
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("[Security Audit] Admin (Id: {AdminId}) revoked all other active sessions ({Count} terminated).", userId, otherSessions.Count);

            return Ok(new { success = true, message = $"Revoked {otherSessions.Count} other active session(s)." });
        }

        // ─── Update Own Profile ──────────────────────────────────────

        [Authorize(Roles = "Admin")]
        [HttpPut("account/profile")]
        public async Task<IActionResult> UpdateOwnProfile([FromBody] UpdateProfileDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "Account not found." });

            if (!string.IsNullOrWhiteSpace(dto.FullName))
                user.FullName = dto.FullName.Trim();

            if (!string.IsNullOrWhiteSpace(dto.Phone))
                user.Phone = dto.Phone.Trim();

            if (dto.ClientBio != null)
                user.ClientBio = dto.ClientBio;

            if (!string.IsNullOrWhiteSpace(dto.PreferredTimezone))
                user.PreferredTimezone = dto.PreferredTimezone;

            if (dto.NotifyLawAmendments.HasValue)
                user.NotifyLawAmendments = dto.NotifyLawAmendments.Value;

            if (dto.NotifyEmailDigest.HasValue)
                user.NotifyEmailDigest = dto.NotifyEmailDigest.Value;

            if (dto.NotifyPushEnabled.HasValue)
                user.NotifyPushEnabled = dto.NotifyPushEnabled.Value;

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Profile] Admin (Id: {AdminId}) updated their profile details.", userId);

            return Ok(new { success = true, message = "Profile updated successfully.", user });
        }

        // ─── Own Audit Log: Fetch Account Security History ──────────

        [Authorize(Roles = "Admin")]
        [HttpGet("account/audit-log")]
        public async Task<IActionResult> GetAccountAuditLog([FromQuery] int limit = 15)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var logs = await _context.LoginHistories
                .AsNoTracking()
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.LoginTime)
                .Take(limit)
                .Select(l => new
                {
                    l.Id,
                    l.IpAddress,
                    l.UserAgent,
                    l.LoginTime,
                    l.Status
                })
                .ToListAsync();

            return Ok(new { success = true, data = logs });
        }

        // ─── Helper: Generate Secure 8-Character Backup Code ─────────

        private static string GenerateBackupCode()
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: I, O, 0, 1
            byte[] randomBytes = new byte[8];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(randomBytes);
            }
            var code = new char[8];
            for (int i = 0; i < 8; i++)
            {
                code[i] = chars[randomBytes[i] % chars.Length];
            }
            return new string(code);
        }
    }
}