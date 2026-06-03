using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CoreApi.Services;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Lawyer")]
    public class LawyerController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILawyerSyncService _syncService;

        public LawyerController(AppDbContext context, IWebHostEnvironment env, ILawyerSyncService syncService)
        {
            _context = context;
            _env = env;
            _syncService = syncService;
        }

        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var profile = await _context.LawyerProfiles
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                profile = new LawyerProfile
                {
                    UserId = userId,
                    BarCouncilNumber = "PENDING",
                    Specialization = "General Practice",
                    ExperienceYears = 0,
                    IsVerified = true,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.LawyerProfiles.Add(profile);
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                userId = profile.UserId,
                fullName = profile.User?.FullName,
                email = profile.User?.Email,
                barCouncilNumber = profile.BarCouncilNumber,
                specialization = profile.Specialization,
                experienceYears = profile.ExperienceYears,
                isVerified = profile.IsVerified,
                city = profile.City,
                bio = profile.Bio,
                phone = profile.Phone,
                consultationFee = profile.ConsultationFee,
                inPersonFee = profile.InPersonFee,
                casesCompleted = profile.CasesCompleted,
                successRate = profile.SuccessRate,
                officeAddress = profile.OfficeAddress,
                education = profile.Education,
                languagesSpoken = profile.LanguagesSpoken,
                isAvailable = profile.IsAvailable,
                avatarUrl = profile.User?.AvatarUrl,
                bannerUrl = profile.BannerUrl,
                // Premium additions
                activeCourts = profile.ActiveCourts,
                responseTime = profile.ResponseTime,
                workingHours = profile.WorkingHours,
                faqsJson = profile.FaqsJson,
                accoladesJson = profile.AccoladesJson,
                casesJson = profile.CasesJson,
                timeSlotsJson = profile.TimeSlotsJson,
                socialLinksJson = profile.SocialLinksJson,
                updatedAt = profile.UpdatedAt
            });
        }

        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateLawyerProfileDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var profile = await _context.LawyerProfiles
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profile == null)
            {
                profile = new LawyerProfile { UserId = userId };
                _context.LawyerProfiles.Add(profile);
            }

            profile.BarCouncilNumber = request.BarCouncilNumber;
            profile.Specialization = request.Specialization;
            profile.ExperienceYears = request.ExperienceYears;
            profile.City = request.City ?? string.Empty;
            profile.Bio = request.Bio ?? string.Empty;
            profile.Phone = request.Phone ?? string.Empty;
            profile.ConsultationFee = request.ConsultationFee;
            profile.InPersonFee = request.InPersonFee;
            profile.CasesCompleted = request.CasesCompleted;
            profile.SuccessRate = request.SuccessRate;
            profile.OfficeAddress = request.OfficeAddress ?? string.Empty;
            profile.Education = request.Education ?? string.Empty;
            profile.LanguagesSpoken = request.LanguagesSpoken ?? "English";
            profile.IsAvailable = request.IsAvailable;
            if (request.BannerUrl != null)
            {
                if (string.IsNullOrEmpty(request.BannerUrl))
                {
                    profile.BannerUrl = null;
                }
                else
                {
                    profile.BannerUrl = SaveBase64File(request.BannerUrl, "banners", $"lawyer_{userId}");
                }
            }
            // Premium assignments
            profile.ActiveCourts = request.ActiveCourts ?? string.Empty;
            profile.ResponseTime = request.ResponseTime ?? "Responds within 24 hours";
            profile.WorkingHours = request.WorkingHours ?? "Mon - Fri: 9:00 AM - 6:00 PM";
            profile.FaqsJson = request.FaqsJson ?? "[]";
            profile.AccoladesJson = request.AccoladesJson ?? "[]";
            profile.CasesJson = request.CasesJson ?? "[]";
            profile.TimeSlotsJson = request.TimeSlotsJson ?? "[]";
            profile.SocialLinksJson = request.SocialLinksJson ?? "{}";
            profile.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await _syncService.SyncProfileToMongoAsync(userId);

            return Ok(new { message = "Profile updated and synchronized successfully!" });
        }

        [HttpPost("sync-all")]
        [AllowAnonymous]
        public async Task<IActionResult> SyncAll()
        {
            try
            {
                await _syncService.SyncAllProfilesToMongoAsync();
                return Ok(new { message = "All lawyer profiles synchronized successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Failed to sync profiles: {ex.Message}" });
            }
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
                Console.WriteLine($"Error saving base64 file: {ex.Message}");
                return null;
            }
        }
    }

    public class UpdateLawyerProfileDto
    {
        public string BarCouncilNumber { get; set; } = string.Empty;
        public string Specialization { get; set; } = string.Empty;
        public int ExperienceYears { get; set; }
        public string City { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public decimal ConsultationFee { get; set; }
        public decimal InPersonFee { get; set; }
        public int CasesCompleted { get; set; }
        public int SuccessRate { get; set; }
        public string OfficeAddress { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
        public string LanguagesSpoken { get; set; } = string.Empty;
        public bool IsAvailable { get; set; }
        // Premium additions
        public string ActiveCourts { get; set; } = string.Empty;
        public string ResponseTime { get; set; } = string.Empty;
        public string WorkingHours { get; set; } = string.Empty;
        public string FaqsJson { get; set; } = string.Empty;
        public string AccoladesJson { get; set; } = string.Empty;
        public string CasesJson { get; set; } = string.Empty;
        public string TimeSlotsJson { get; set; } = string.Empty;
        public string SocialLinksJson { get; set; } = string.Empty;
        public string? BannerUrl { get; set; }
    }
}
