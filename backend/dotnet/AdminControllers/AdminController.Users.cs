using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;

namespace CoreApi.Controllers
{
    public partial class AdminController : ControllerBase
    {
        // ═══════════════════════════════════════════════════════════════
        //  USER MANAGEMENT CRUD
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 15,
            [FromQuery] string? role = null,
            [FromQuery] string? search = null,
            [FromQuery] bool? isActive = null,
            [FromQuery] bool? isEmailVerified = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? sort = "newest",
            [FromQuery] string? sortOrder = "desc")
        {
            var query = _context.Users.AsNoTracking().AsQueryable();

            if (startDate.HasValue)
                query = query.Where(u => u.CreatedAt >= startDate.Value.ToUniversalTime());

            if (endDate.HasValue)
                query = query.Where(u => u.CreatedAt <= endDate.Value.ToUniversalTime().AddDays(1));

            if (!string.IsNullOrEmpty(role))
                query = query.Where(u => u.Role == role);

            if (isActive.HasValue)
                query = query.Where(u => u.IsActive == isActive.Value);

            if (isEmailVerified.HasValue)
                query = query.Where(u => u.IsEmailVerified == isEmailVerified.Value);

            if (!string.IsNullOrEmpty(search))
            {
                var s = search.Trim();
                query = query.Where(u => EF.Functions.Like(u.FullName, $"%{s}%") || EF.Functions.Like(u.Email, $"%{s}%"));
            }

            var total = await query.CountAsync();

            var isAsc = string.Equals(sortOrder, "asc", StringComparison.OrdinalIgnoreCase);
            query = sort?.ToLower() switch
            {
                "name" or "fullname" => isAsc ? query.OrderBy(u => u.FullName) : query.OrderByDescending(u => u.FullName),
                "email" => isAsc ? query.OrderBy(u => u.Email) : query.OrderByDescending(u => u.Email),
                "role" => isAsc ? query.OrderBy(u => u.Role) : query.OrderByDescending(u => u.Role),
                "status" => isAsc ? query.OrderBy(u => u.IsActive) : query.OrderByDescending(u => u.IsActive),
                "oldest" => query.OrderBy(u => u.CreatedAt),
                _ => isAsc ? query.OrderBy(u => u.CreatedAt) : query.OrderByDescending(u => u.CreatedAt)
            };

            if (!_cache.TryGetValue("UserRoleMetricsSummary", out (int totalAdmins, int totalLawyers, int totalClients, int total2Fa) metrics))
            {
                var roleCounts = await _context.Users.AsNoTracking()
                    .GroupBy(u => u.Role)
                    .Select(g => new { Role = g.Key, Count = g.Count() })
                    .ToListAsync();

                var admins = roleCounts.FirstOrDefault(r => r.Role == "Admin")?.Count ?? 0;
                var lawyers = roleCounts.FirstOrDefault(r => r.Role == "Lawyer")?.Count ?? 0;
                var clients = roleCounts.FirstOrDefault(r => r.Role == "Client")?.Count ?? 0;
                var t2Fa = await _context.Users.AsNoTracking().CountAsync(u => u.IsTwoFactorEnabled);

                metrics = (admins, lawyers, clients, t2Fa);
                _cache.Set("UserRoleMetricsSummary", metrics, TimeSpan.FromSeconds(30));
            }

            var totalAdmins = metrics.totalAdmins;
            var totalLawyers = metrics.totalLawyers;
            var totalClients = metrics.totalClients;
            var total2Fa = metrics.total2Fa;

            var users = await query
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.Role,
                    u.IsActive,
                    u.IsEmailVerified,
                    u.IsTwoFactorEnabled,
                    u.AuthProvider,
                    u.LastLoginAt,
                    u.LastIpAddress,
                    u.Phone,
                    u.ClientCity,
                    u.AvatarUrl,
                    u.CreatedAt,
                    u.IdentityStatus
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                data = users,
                summary = new
                {
                    totalUsers = total,
                    totalAdmins,
                    totalLawyers,
                    totalClients,
                    twoFactorPct = (totalAdmins + totalLawyers + totalClients) > 0 
                        ? (int)Math.Round((double)total2Fa / (totalAdmins + totalLawyers + totalClients) * 100) 
                        : 0
                },
                pagination = new
                {
                    total,
                    page,
                    limit,
                    pages = (int)Math.Ceiling((double)total / limit)
                }
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users/{id}")]
        public async Task<IActionResult> GetUser(int id)
        {
            var user = await _context.Users
                .Include(u => u.LawyerProfile)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null) return NotFound(new { message = "User not found." });

            var loginCount = await _context.LoginHistories.CountAsync(l => l.UserId == id);
            var sessionCount = await _context.ActiveSessions.CountAsync(s => s.UserId == id);
            var bookmarkCount = await _context.Bookmarks.CountAsync(b => b.ClientId == id);
            var reviewCount = await _context.Reviews.CountAsync(r => r.UserId == id);
            var consultationCount = await _context.Consultations
                .CountAsync(c => c.ClientId == id || c.LawyerId == id);

            var recentLogins = await _context.LoginHistories
                .Where(l => l.UserId == id)
                .OrderByDescending(l => l.LoginTime)
                .Take(10)
                .Select(l => new { l.IpAddress, l.UserAgent, l.LoginTime, l.Status })
                .ToListAsync();

            return Ok(new
            {
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Role,
                    user.IsActive,
                    user.IsEmailVerified,
                    user.IsTwoFactorEnabled,
                    user.Phone,
                    user.ClientCity,
                    user.ClientState,
                    user.ClientLanguage,
                    user.ClientInterest,
                    user.ClientBio,
                    user.AvatarUrl,
                    user.Gender,
                    user.DateOfBirth,
                    user.AddressLine1,
                    user.ClientZip,
                    user.IdentityStatus,
                    user.CreatedAt,
                    lawyerProfile = user.LawyerProfile != null ? new
                    {
                        user.LawyerProfile.BarCouncilNumber,
                        user.LawyerProfile.Specialization,
                        user.LawyerProfile.ExperienceYears,
                        user.LawyerProfile.IsVerified,
                        user.LawyerProfile.City,
                        user.LawyerProfile.ConsultationFee,
                        user.LawyerProfile.InPersonFee,
                        user.LawyerProfile.CasesCompleted,
                        user.LawyerProfile.SuccessRate,
                        user.LawyerProfile.IsAvailable
                    } : null
                },
                activity = new
                {
                    loginCount,
                    sessionCount,
                    bookmarkCount,
                    reviewCount,
                    consultationCount,
                    recentLogins
                }
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("users/{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] AdminUpdateUserDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            // Prevent editing own admin account's role
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (id == currentUserId && dto.Role != null && dto.Role != "Admin")
            {
                _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) attempted to downgrade their own admin role.", currentUserId);
                return BadRequest(new { message = "Cannot change your own admin role." });
            }

            if (dto.FullName != null) user.FullName = dto.FullName;
            if (dto.Email != null) user.Email = dto.Email;
            if (dto.Role != null) user.Role = dto.Role;
            if (dto.Phone != null) user.Phone = dto.Phone;
            if (dto.ClientCity != null) user.ClientCity = dto.ClientCity;
            if (dto.ClientState != null) user.ClientState = dto.ClientState;
            if (dto.IsActive.HasValue) user.IsActive = dto.IsActive.Value;
            if (dto.IsEmailVerified.HasValue) user.IsEmailVerified = dto.IsEmailVerified.Value;

            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Admin (Id: {AdminId}) updated user profile (Target UserId: {TargetUserId}, Role: {Role}, IsActive: {IsActive})", currentUserId, id, user.Role, user.IsActive);

            return Ok(new { success = true, message = "User updated." });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (id == currentUserId)
            {
                _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) attempted to delete their own account.", currentUserId);
                return BadRequest(new { message = "Cannot delete your own account." });
            }

            // Soft delete
            user.IsActive = false;
            await _context.SaveChangesAsync();

            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) deactivated user account (Target UserId: {TargetUserId}, Email: {TargetEmail})", currentUserId, id, user.Email);

            return Ok(new { success = true, message = "User deactivated." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("users/{id}/reset-password")]
        public async Task<IActionResult> ResetUserPassword(int id)
        {
            var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            var tempPassword = "Reset@" + Guid.NewGuid().ToString("N").Substring(0, 8);
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword);
            await _context.SaveChangesAsync();

            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) triggered password reset for user (Target UserId: {TargetUserId}, Email: {TargetEmail})", adminId ?? "Unknown", id, user.Email);

            return Ok(new { success = true, tempPassword, message = "Password reset successfully." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("users/bulk-status")]
        public async Task<IActionResult> BulkUpdateUserStatus([FromBody] AdminBulkStatusDto dto)
        {
            if (dto.UserIds == null || !dto.UserIds.Any())
            {
                return BadRequest(new { message = "No user IDs provided." });
            }

            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            // Protect current admin from being batch deactivated
            var targetIds = dto.UserIds.Where(id => id != currentUserId).ToList();

            var users = await _context.Users.Where(u => targetIds.Contains(u.Id) && u.Role != "Admin").ToListAsync();
            foreach (var u in users)
            {
                u.IsActive = dto.IsActive;
            }

            await _context.SaveChangesAsync();
            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) bulk updated {Count} user account(s) to IsActive={IsActive}", currentUserId, users.Count, dto.IsActive);

            return Ok(new { success = true, message = $"Bulk status updated for {users.Count} user account(s)." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("users/{id}/revoke-sessions")]
        public async Task<IActionResult> RevokeUserSessions(int id)
        {
            var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            var activeSessions = await _context.ActiveSessions.Where(s => s.UserId == id).ToListAsync();
            _context.ActiveSessions.RemoveRange(activeSessions);
            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) revoked all active sessions for user (Target UserId: {TargetUserId}, Email: {TargetEmail})", adminId ?? "Unknown", id, user.Email);

            return Ok(new { success = true, message = $"All active sessions revoked for {user.FullName}." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("users/{id}/verify-email")]
        public async Task<IActionResult> VerifyUserEmail(int id)
        {
            var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            user.IsEmailVerified = true;
            await _context.SaveChangesAsync();

            _logger.LogInformation("[Security Audit] Admin (Id: {AdminId}) manually verified email for user (Target UserId: {TargetUserId}, Email: {TargetEmail})", adminId ?? "Unknown", id, user.Email);

            return Ok(new { success = true, message = $"Email manually verified for {user.FullName}." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("users/{id}/role")]
        public async Task<IActionResult> UpdateUserRole(int id, [FromBody] AdminRoleDto dto)
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            if (id == currentUserId)
            {
                return BadRequest(new { message = "Cannot modify your own admin role." });
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            if (string.IsNullOrWhiteSpace(dto.Role) || (dto.Role != "Client" && dto.Role != "Lawyer" && dto.Role != "Admin"))
            {
                return BadRequest(new { message = "Invalid role specified." });
            }

            var oldRole = user.Role;
            user.Role = dto.Role;
            await _context.SaveChangesAsync();

            _cache.Remove("UserRoleMetricsSummary");

            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) updated role for user (Target UserId: {TargetUserId}) from {OldRole} to {NewRole}", currentUserId, id, oldRole, dto.Role);

            return Ok(new { success = true, message = $"Role for {user.FullName} changed to {dto.Role}." });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users/{id}/audit-log")]
        public async Task<IActionResult> GetUserAuditLog(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            var auditTrail = new System.Collections.Generic.List<object>();

            // 1. Account Created Event
            auditTrail.Add(new
            {
                timestamp = user.CreatedAt,
                action = "Account Registered",
                detail = $"Account created in database. Initial role assigned: {user.Role}.",
                type = "account",
                badgeClass = "bg-purple-400"
            });

            // 2. Email Verified Event
            if (user.IsEmailVerified)
            {
                auditTrail.Add(new
                {
                    timestamp = user.CreatedAt.AddMinutes(1),
                    action = "Email Verification Confirmed",
                    detail = $"Primary email address ({user.Email}) verified.",
                    type = "verification",
                    badgeClass = "bg-emerald-400"
                });
            }

            // 3. 2FA Status Event
            auditTrail.Add(new
            {
                timestamp = user.CreatedAt,
                action = user.IsTwoFactorEnabled ? "2FA TOTP Protection Enabled" : "Standard Authentication Configured",
                detail = user.IsTwoFactorEnabled ? "TOTP authenticator 2-Factor protection active." : "1FA standard password authentication active.",
                type = "security",
                badgeClass = user.IsTwoFactorEnabled ? "bg-emerald-400" : "bg-sky-400"
            });

            // 4. Logins
            var logins = await _context.LoginHistories
                .Where(l => l.UserId == id)
                .OrderByDescending(l => l.LoginTime)
                .Take(15)
                .ToListAsync();

            foreach (var log in logins)
            {
                auditTrail.Add(new
                {
                    timestamp = log.LoginTime,
                    action = log.Status == "Success" ? "Authentication Authorized" : "Failed Login Attempt",
                    detail = $"IP: {log.IpAddress ?? "N/A"} • Browser: {log.UserAgent ?? "Standard Client"}",
                    type = "auth",
                    badgeClass = log.Status == "Success" ? "bg-emerald-400" : "bg-red-400"
                });
            }

            // 5. Active Sessions
            var sessions = await _context.ActiveSessions
                .Where(s => s.UserId == id)
                .OrderByDescending(s => s.CreatedAt)
                .Take(10)
                .ToListAsync();

            foreach (var s in sessions)
            {
                auditTrail.Add(new
                {
                    timestamp = s.CreatedAt,
                    action = "OAuth Session Issued",
                    detail = $"Active JWT session token issued for IP: {s.IpAddress ?? "N/A"}",
                    type = "session",
                    badgeClass = "bg-indigo-400"
                });
            }

            // Sort newest to oldest
            var sorted = auditTrail
                .OrderByDescending(x => ((dynamic)x).timestamp)
                .ToList();

            return Ok(new { success = true, userId = id, data = sorted });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("users/{id}/impersonate")]
        public async Task<IActionResult> ImpersonateUser(int id)
        {
            var adminId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "Admin";

            var targetUser = await _context.Users.FindAsync(id);
            if (targetUser == null) return NotFound(new { message = "User not found." });

            if (targetUser.Role == "Admin")
            {
                return BadRequest(new { message = "Cannot impersonate another administrator account." });
            }

            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}, Email: {AdminEmail}) initiated User Impersonation for Target UserId: {TargetUserId} ({TargetEmail})", adminId, adminEmail, targetUser.Id, targetUser.Email);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, targetUser.Id.ToString()),
                new Claim(ClaimTypes.Email, targetUser.Email),
                new Claim(ClaimTypes.Role, targetUser.Role),
                new Claim(ClaimTypes.Name, targetUser.FullName),
                new Claim("IsImpersonated", "true"),
                new Claim("ImpersonatedBy", adminEmail)
            };

            var key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(
                _configuration.GetSection("Jwt:Key").Value!));

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512);

            var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(15),
                signingCredentials: creds
            );

            var impersonationToken = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token);

            return Ok(new
            {
                success = true,
                message = $"Impersonation token generated for {targetUser.FullName}.",
                token = impersonationToken,
                targetUser = new { targetUser.Id, targetUser.FullName, targetUser.Email, targetUser.Role },
                redirectUrl = $"http://localhost:4200/auth/impersonate?token={impersonationToken}"
            });
        }
    }

    public class AdminRoleDto
    {
        public string Role { get; set; } = string.Empty;
    }

    public class AdminBulkStatusDto
    {
        public System.Collections.Generic.List<int> UserIds { get; set; } = new();
        public bool IsActive { get; set; }
    }
}