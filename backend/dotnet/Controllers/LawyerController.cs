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
            profile.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

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

                var syncData = new
                {
                    name = profile.User?.FullName ?? "Advocate",
                    specializations = specArray,
                    city = request.City ?? "Unknown",
                    experience = profile.ExperienceYears,
                    bio = request.Bio ?? string.Empty,
                    phone = request.Phone ?? string.Empty,
                    email = profile.User?.Email ?? string.Empty,
                    isVerified = profile.IsVerified
                };

                var nodeUrl = "http://host.docker.internal:5000/api/lawyers/sync";
                var response = await httpClient.PutAsJsonAsync(nodeUrl, syncData);
                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"Sync Warning: Node.js responded with {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Sync Error: {ex.Message}");
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
    }
}
