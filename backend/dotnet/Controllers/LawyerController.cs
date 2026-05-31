using System;
using System.Net.Http;
using System.Net.Http.Json;
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
    [Authorize(Roles = "Lawyer")]
    public class LawyerController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LawyerController(AppDbContext context)
        {
            _context = context;
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
                officeAddress = profile.OfficeAddress,
                education = profile.Education,
                languagesSpoken = profile.LanguagesSpoken,
                isAvailable = profile.IsAvailable,
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
            profile.OfficeAddress = request.OfficeAddress ?? string.Empty;
            profile.Education = request.Education ?? string.Empty;
            profile.LanguagesSpoken = request.LanguagesSpoken ?? "English";
            profile.IsAvailable = request.IsAvailable;
            profile.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Calculate dynamic average rating from MySQL Reviews
            double averageRating = 4.5;
            var lawyerName = profile.User?.FullName;
            if (!string.IsNullOrEmpty(lawyerName))
            {
                var ratings = await _context.Reviews
                    .Where(r => r.TargetName == lawyerName)
                    .Select(r => (double)r.Rating)
                    .ToListAsync();

                if (ratings.Any())
                {
                    averageRating = Math.Round(ratings.Average(), 1);
                }
            }

            // Sync to MongoDB (Node.js API)
            try
            {
                using var httpClient = new HttpClient();
                
                // Parse specializations string to array
                string[] specArray = Array.Empty<string>();
                if (!string.IsNullOrEmpty(profile.Specialization))
                {
                    specArray = profile.Specialization.Split(',', StringSplitOptions.RemoveEmptyEntries);
                    for (int i = 0; i < specArray.Length; i++)
                    {
                        specArray[i] = specArray[i].Trim();
                    }
                }

                // Parse languages spoken string to array
                string[] langArray = Array.Empty<string>();
                if (!string.IsNullOrEmpty(profile.LanguagesSpoken))
                {
                    langArray = profile.LanguagesSpoken.Split(',', StringSplitOptions.RemoveEmptyEntries);
                    for (int i = 0; i < langArray.Length; i++)
                    {
                        langArray[i] = langArray[i].Trim();
                    }
                }

                var syncData = new
                {
                    name = profile.User?.FullName ?? "Advocate",
                    specializations = specArray,
                    city = profile.City,
                    experience = profile.ExperienceYears,
                    bio = profile.Bio,
                    phone = profile.Phone,
                    email = profile.User?.Email ?? string.Empty,
                    isVerified = profile.IsVerified,
                    consultationFee = (double)profile.ConsultationFee,
                    officeAddress = profile.OfficeAddress,
                    education = profile.Education,
                    languagesSpoken = langArray,
                    isAvailable = profile.IsAvailable,
                    rating = averageRating
                };

                var nodeUrl = "http://host.docker.internal:5000/api/lawyers/sync";
                int retries = 3;
                bool syncSuccess = false;
                while (retries > 0 && !syncSuccess)
                {
                    try
                    {
                        var response = await httpClient.PutAsJsonAsync(nodeUrl, syncData);
                        if (response.IsSuccessStatusCode)
                        {
                            syncSuccess = true;
                        }
                        else
                        {
                            Console.WriteLine($"Sync Warning: Node.js responded with {response.StatusCode}. Retrying...");
                            retries--;
                            if (retries > 0) await Task.Delay(1000);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Sync Attempt Error: {ex.Message}. Retrying...");
                        retries--;
                        if (retries > 0) await Task.Delay(1000);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Critical Sync Error: {ex.Message}");
            }

            return Ok(new { message = "Profile updated and synchronized successfully!" });
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
        public string OfficeAddress { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
        public string LanguagesSpoken { get; set; } = string.Empty;
        public bool IsAvailable { get; set; }
    }
}
