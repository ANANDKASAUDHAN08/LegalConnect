using System;
using System.Collections.Generic;
using System.Linq;
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
        //  REVIEWS MANAGEMENT
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("reviews")]
        public async Task<IActionResult> GetReviews(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 15,
            [FromQuery] int? rating = null,
            [FromQuery] string? role = null)
        {
            var query = _context.Reviews.AsQueryable();

            if (rating.HasValue)
                query = query.Where(r => r.Rating == rating.Value);
            if (!string.IsNullOrEmpty(role))
                query = query.Where(r => r.UserRole == role);

            var total = await query.CountAsync();
            var reviews = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            return Ok(new { success = true, data = reviews, pagination = new { total, page, limit } });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("reviews/{id}")]
        public async Task<IActionResult> DeleteReview(int id)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound(new { message = "Review not found." });

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Review deleted." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  CONSULTATIONS MANAGEMENT
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("consultations")]
        public async Task<IActionResult> GetConsultations(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 15,
            [FromQuery] string? status = null)
        {
            var query = _context.Consultations
                .Include(c => c.Client)
                .Include(c => c.Lawyer)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.Status == status);

            var total = await query.CountAsync();
            var pending = await _context.Consultations.CountAsync(c => c.Status == "Pending");
            var contacted = await _context.Consultations.CountAsync(c => c.Status == "Contacted");
            var closed = await _context.Consultations.CountAsync(c => c.Status == "Closed");

            var consultations = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(c => new
                {
                    c.Id,
                    c.ClientName,
                    c.ClientEmail,
                    clientUser = c.Client != null ? c.Client.FullName : null,
                    lawyerName = c.Lawyer != null ? c.Lawyer.FullName : "Unknown",
                    lawyerEmail = c.Lawyer != null ? c.Lawyer.Email : null,
                    c.Message,
                    c.Status,
                    c.CreatedAt
                })
                .ToListAsync();

            return Ok(new {
                success = true,
                data = consultations,
                pagination = new { total, page, limit },
                metrics = new { total, pending, contacted, closed }
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("consultations/{id}/status")]
        public async Task<IActionResult> UpdateConsultationStatus(int id, [FromBody] AdminUpdateStatusDto dto)
        {
            var consultation = await _context.Consultations.FindAsync(id);
            if (consultation == null) return NotFound(new { message = "Consultation not found." });

            consultation.Status = dto.Status;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Status updated." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  ANNOUNCEMENTS MANAGEMENT
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("announcements")]
        public async Task<IActionResult> GetAnnouncements()
        {
            var announcements = await _context.SystemAnnouncements
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            var results = new List<object>();
            foreach (var a in announcements)
            {
                var readCount = await _context.UserAnnouncementReads.CountAsync(r => r.AnnouncementId == a.Id);
                results.Add(new
                {
                    a.Id,
                    a.Version,
                    a.Title,
                    a.Summary,
                    a.DetailsMarkdown,
                    type = a.Type.ToString(),
                    a.IsModalTrigger,
                    a.IsActive,
                    a.CreatedAt,
                    a.PublishedAt,
                    readCount
                });
            }

            return Ok(new { success = true, data = results });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("announcements")]
        public async Task<IActionResult> CreateAnnouncement([FromBody] AnnouncementCreateDto dto)
        {
            var announcement = new SystemAnnouncement
            {
                Version = dto.Version,
                Title = dto.Title,
                Summary = dto.Summary,
                DetailsMarkdown = dto.DetailsMarkdown,
                Type = dto.Type,
                IsModalTrigger = dto.IsModalTrigger,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow,
                PublishedAt = dto.PublishedAt ?? DateTime.UtcNow
            };

            _context.SystemAnnouncements.Add(announcement);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Announcement created.", id = announcement.Id });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("announcements/{id}")]
        public async Task<IActionResult> UpdateAnnouncement(int id, [FromBody] AnnouncementCreateDto dto)
        {
            var announcement = await _context.SystemAnnouncements.FindAsync(id);
            if (announcement == null) return NotFound(new { message = "Announcement not found." });

            announcement.Version = dto.Version;
            announcement.Title = dto.Title;
            announcement.Summary = dto.Summary;
            announcement.DetailsMarkdown = dto.DetailsMarkdown;
            announcement.Type = dto.Type;
            announcement.IsModalTrigger = dto.IsModalTrigger;
            announcement.IsActive = dto.IsActive;
            if (dto.PublishedAt.HasValue) announcement.PublishedAt = dto.PublishedAt.Value;

            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Announcement updated." });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("announcements/{id}")]
        public async Task<IActionResult> DeleteAnnouncement(int id)
        {
            var announcement = await _context.SystemAnnouncements.FindAsync(id);
            if (announcement == null) return NotFound(new { message = "Announcement not found." });

            _context.SystemAnnouncements.Remove(announcement);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Announcement deleted." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  CONTACT SUBMISSIONS
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("contacts")]
        public async Task<IActionResult> GetContactSubmissions(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 15,
            [FromQuery] string? status = null)
        {
            var contactsList = new List<object>();

            // 1. Fetch real MongoDB tickets from Node backend
            try
            {
                var nodeBaseUrl = _configuration["NodeServices:BaseUrl"] ?? "http://localhost:5000";
                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(3);
                var response = await httpClient.GetAsync($"{nodeBaseUrl}/api/legal/contact/all-tickets");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                    if (json.TryGetProperty("tickets", out var ticketsProp) && ticketsProp.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var t in ticketsProp.EnumerateArray())
                        {
                            var tStatus = t.TryGetProperty("status", out var st) ? st.GetString() ?? "New" : "New";
                            if (!string.IsNullOrEmpty(status) && !tStatus.Equals(status, StringComparison.OrdinalIgnoreCase))
                                continue;

                            contactsList.Add(new
                            {
                                id = t.TryGetProperty("ticketId", out var tid) ? tid.GetString() : Guid.NewGuid().ToString("N"),
                                fullName = t.TryGetProperty("name", out var n) ? n.GetString() : "User",
                                email = t.TryGetProperty("email", out var e) ? e.GetString() : "",
                                subject = t.TryGetProperty("subject", out var s) ? s.GetString() : "Inquiry",
                                message = t.TryGetProperty("message", out var m) ? m.GetString() : "",
                                status = tStatus,
                                createdAt = t.TryGetProperty("timestamp", out var ts) ? ts.GetString() : DateTime.UtcNow.ToString("o")
                            });
                        }
                    }
                }
            }
            catch {}

            // 2. Fetch MySQL ContactSubmissions
            var query = _context.ContactSubmissions.AsQueryable();
            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.Status == status);

            var sqlContacts = await query
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    id = c.Id.ToString(),
                    fullName = c.FullName,
                    email = c.Email,
                    subject = c.Subject,
                    message = c.Message,
                    status = c.Status,
                    createdAt = c.CreatedAt.ToString("o")
                })
                .ToListAsync();

            contactsList.AddRange(sqlContacts);

            var total = contactsList.Count;
            var paged = contactsList.Skip((page - 1) * limit).Take(limit).ToList();

            return Ok(new { success = true, data = paged, pagination = new { total, page, limit } });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("contacts/{id}/status")]
        public async Task<IActionResult> UpdateContactStatus(int id, [FromBody] AdminUpdateStatusDto dto)
        {
            var contact = await _context.ContactSubmissions.FindAsync(id);
            if (contact == null) return NotFound(new { message = "Contact not found." });

            contact.Status = dto.Status;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Status updated." });
        }
    }
}
