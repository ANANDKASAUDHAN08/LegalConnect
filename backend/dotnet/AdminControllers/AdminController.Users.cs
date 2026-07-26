using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
            [FromQuery] string? sort = "newest")
        {
            var query = _context.Users.AsNoTracking().AsQueryable();

            if (!string.IsNullOrEmpty(role))
                query = query.Where(u => u.Role == role);

            if (isActive.HasValue)
                query = query.Where(u => u.IsActive == isActive.Value);

            if (isEmailVerified.HasValue)
                query = query.Where(u => u.IsEmailVerified == isEmailVerified.Value);

            if (!string.IsNullOrEmpty(search))
            {
                var s = search.ToLower();
                query = query.Where(u => u.FullName.ToLower().Contains(s) || u.Email.ToLower().Contains(s));
            }

            var total = await query.CountAsync();

            query = sort switch
            {
                "oldest" => query.OrderBy(u => u.CreatedAt),
                "name" => query.OrderBy(u => u.FullName),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };

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
    }
}