using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    public partial class AdminController : ControllerBase
    {
        // ═══════════════════════════════════════════════════════════════
        //  SESSIONS & SECURITY LOGS
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("sessions")]
        public async Task<IActionResult> GetActiveSessions([FromQuery] int page = 1, [FromQuery] int limit = 20)
        {
            var total = await _context.ActiveSessions.CountAsync();
            var sessions = await _context.ActiveSessions
                .AsNoTracking()
                .Include(s => s.User)
                .OrderByDescending(s => s.LastActive)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(s => new
                {
                    s.Id,
                    s.UserId,
                    userName = s.User != null ? s.User.FullName : "Anonymous User",
                    userEmail = s.User != null ? s.User.Email : (s.TokenId ?? "N/A"),
                    userRole = s.User != null ? s.User.Role : "Guest",
                    s.IpAddress,
                    s.UserAgent,
                    s.CreatedAt,
                    s.LastActive
                })
                .ToListAsync();

            return Ok(new { success = true, data = sessions, pagination = new { total, page, limit } });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("sessions/{id}")]
        public async Task<IActionResult> ForceLogout(int id)
        {
            var adminId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var session = await _context.ActiveSessions.FindAsync(id);
            if (session == null) return NotFound(new { message = "Session not found." });

            _context.ActiveSessions.Remove(session);
            await _context.SaveChangesAsync();

            _logger.LogWarning("[Security Audit] Admin (Id: {AdminId}) forcefully terminated active session ID: {SessionId} (Target UserId: {TargetUserId})", adminId ?? "Unknown", id, session.UserId);

            return Ok(new { success = true, message = "Session terminated." });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("login-history")]
        public async Task<IActionResult> GetLoginHistory(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 20,
            [FromQuery] string? status = null)
        {
            var query = _context.LoginHistories
                .AsNoTracking()
                .Include(l => l.User)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(l => l.Status == status);

            var total = await query.CountAsync();
            var history = await query
                .OrderByDescending(l => l.LoginTime)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(l => new
                {
                    l.Id,
                    l.UserId,
                    userName = l.User != null ? l.User.FullName : "Guest",
                    userEmail = l.User != null ? l.User.Email : "N/A",
                    l.IpAddress,
                    l.UserAgent,
                    l.LoginTime,
                    l.Status
                })
                .ToListAsync();

            return Ok(new { success = true, data = history, pagination = new { total, page, limit } });
        }
    }
}
