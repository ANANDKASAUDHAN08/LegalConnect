using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AnnouncementController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AnnouncementController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(claim, out int userId))
            {
                return userId;
            }
            return null;
        }

        /// <summary>
        /// Lightweight endpoint to get current system version and latest update info.
        /// </summary>
        [HttpGet("system-version")]
        public async Task<IActionResult> GetSystemVersion()
        {
            var latest = await _context.SystemAnnouncements
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.PublishedAt)
                .FirstOrDefaultAsync();

            return Ok(new VersionCheckDto
            {
                CurrentVersion = latest?.Version ?? "1.2.0",
                HasMajorUpdate = latest?.Type == AnnouncementType.MajorRelease,
                LatestAnnouncementId = latest?.Id ?? 0,
                LatestTitle = latest?.Title ?? "LegalConnect Platform Update"
            });
        }

        /// <summary>
        /// Get active announcements with per-user unread/dismissed status.
        /// </summary>
        [HttpGet("latest")]
        public async Task<IActionResult> GetLatestAnnouncements()
        {
            var userId = GetCurrentUserId();

            var announcements = await _context.SystemAnnouncements
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.PublishedAt)
                .Take(10)
                .ToListAsync();

            List<UserAnnouncementRead> userReads = new();
            if (userId.HasValue)
            {
                var annIds = announcements.Select(a => a.Id).ToList();
                userReads = await _context.UserAnnouncementReads
                    .Where(r => r.UserId == userId.Value && annIds.Contains(r.AnnouncementId))
                    .ToListAsync();
            }

            var result = announcements.Select(a =>
            {
                var readRecord = userReads.FirstOrDefault(r => r.AnnouncementId == a.Id);
                return new SystemAnnouncementDto
                {
                    Id = a.Id,
                    Version = a.Version,
                    Title = a.Title,
                    Summary = a.Summary,
                    DetailsMarkdown = a.DetailsMarkdown,
                    TypeName = a.Type.ToString(),
                    TypeValue = (int)a.Type,
                    IsModalTrigger = a.IsModalTrigger,
                    IsRead = readRecord != null,
                    IsDismissedModal = readRecord?.DismissedModal ?? false,
                    PublishedAt = a.PublishedAt
                };
            });

            return Ok(result);
        }

        /// <summary>
        /// Get all historical system release notes and bug fix announcements.
        /// </summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetAnnouncementHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 15)
        {
            var userId = GetCurrentUserId();

            var query = _context.SystemAnnouncements.Where(a => a.IsActive).OrderByDescending(a => a.PublishedAt);
            var total = await query.CountAsync();

            var announcements = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            List<UserAnnouncementRead> userReads = new();
            if (userId.HasValue)
            {
                var annIds = announcements.Select(a => a.Id).ToList();
                userReads = await _context.UserAnnouncementReads
                    .Where(r => r.UserId == userId.Value && annIds.Contains(r.AnnouncementId))
                    .ToListAsync();
            }

            var dtos = announcements.Select(a =>
            {
                var readRecord = userReads.FirstOrDefault(r => r.AnnouncementId == a.Id);
                return new SystemAnnouncementDto
                {
                    Id = a.Id,
                    Version = a.Version,
                    Title = a.Title,
                    Summary = a.Summary,
                    DetailsMarkdown = a.DetailsMarkdown,
                    TypeName = a.Type.ToString(),
                    TypeValue = (int)a.Type,
                    IsModalTrigger = a.IsModalTrigger,
                    IsRead = readRecord != null,
                    IsDismissedModal = readRecord?.DismissedModal ?? false,
                    PublishedAt = a.PublishedAt
                };
            });

            return Ok(new
            {
                totalItems = total,
                page,
                pageSize,
                data = dtos
            });
        }

        /// <summary>
        /// Mark an announcement as read for current user.
        /// </summary>
        [HttpPost("mark-read/{id}")]
        [Authorize]
        public async Task<IActionResult> MarkRead(int id)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var readRecord = await _context.UserAnnouncementReads
                .FirstOrDefaultAsync(r => r.UserId == userId && r.AnnouncementId == id);

            if (readRecord == null)
            {
                readRecord = new UserAnnouncementRead
                {
                    UserId = userId,
                    AnnouncementId = id,
                    ReadAt = DateTime.UtcNow,
                    DismissedModal = true
                };
                _context.UserAnnouncementReads.Add(readRecord);
            }
            else
            {
                readRecord.ReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "Announcement marked as read." });
        }

        /// <summary>
        /// Dismiss the What's New modal for an announcement.
        /// </summary>
        [HttpPost("dismiss-modal/{id}")]
        public async Task<IActionResult> DismissModal(int id)
        {
            var userId = GetCurrentUserId();
            if (userId.HasValue)
            {
                var readRecord = await _context.UserAnnouncementReads
                    .FirstOrDefaultAsync(r => r.UserId == userId.Value && r.AnnouncementId == id);

                if (readRecord == null)
                {
                    readRecord = new UserAnnouncementRead
                    {
                        UserId = userId.Value,
                        AnnouncementId = id,
                        ReadAt = DateTime.UtcNow,
                        DismissedModal = true
                    };
                    _context.UserAnnouncementReads.Add(readRecord);
                }
                else
                {
                    readRecord.DismissedModal = true;
                }

                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true, message = "Modal dismissed." });
        }

        /// <summary>
        /// Admin endpoint to publish a major release or bug fix announcement.
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateAnnouncement([FromBody] CreateAnnouncementDto dto)
        {
            var announcement = new SystemAnnouncement
            {
                Version = dto.Version,
                Title = dto.Title,
                Summary = dto.Summary,
                DetailsMarkdown = dto.DetailsMarkdown,
                Type = dto.Type,
                IsModalTrigger = dto.IsModalTrigger,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                PublishedAt = DateTime.UtcNow
            };

            _context.SystemAnnouncements.Add(announcement);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Announcement published successfully!", data = announcement });
        }
    }
}