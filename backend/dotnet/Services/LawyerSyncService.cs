using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Services
{
    public class LawyerSyncService : ILawyerSyncService
    {
        private readonly AppDbContext _context;

        public LawyerSyncService(AppDbContext context)
        {
            _context = context;
        }

        public async Task SyncProfileToMongoAsync(int userId)
        {
            try
            {
                var profile = await _context.LawyerProfiles
                    .Include(p => p.User)
                    .FirstOrDefaultAsync(p => p.UserId == userId);

                if (profile == null)
                {
                    Console.WriteLine($"Sync Error: Profile not found for userId {userId}");
                    return;
                }

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

                // Parse active courts string to array
                string[] courtArray = Array.Empty<string>();
                if (!string.IsNullOrEmpty(profile.ActiveCourts))
                {
                    courtArray = profile.ActiveCourts.Split(',', StringSplitOptions.RemoveEmptyEntries);
                    for (int i = 0; i < courtArray.Length; i++)
                    {
                        courtArray[i] = courtArray[i].Trim();
                    }
                }

                // Parse JSON array and object fields
                var faqs = Array.Empty<object>();
                try {
                    faqs = System.Text.Json.JsonSerializer.Deserialize<object[]>(string.IsNullOrEmpty(profile.FaqsJson) ? "[]" : profile.FaqsJson) ?? Array.Empty<object>();
                } catch {}

                var accolades = Array.Empty<object>();
                try {
                    accolades = System.Text.Json.JsonSerializer.Deserialize<object[]>(string.IsNullOrEmpty(profile.AccoladesJson) ? "[]" : profile.AccoladesJson) ?? Array.Empty<object>();
                } catch {}

                var casesList = Array.Empty<object>();
                try {
                    casesList = System.Text.Json.JsonSerializer.Deserialize<object[]>(string.IsNullOrEmpty(profile.CasesJson) ? "[]" : profile.CasesJson) ?? Array.Empty<object>();
                } catch {}

                var timeSlots = Array.Empty<object>();
                try {
                    timeSlots = System.Text.Json.JsonSerializer.Deserialize<object[]>(string.IsNullOrEmpty(profile.TimeSlotsJson) ? "[]" : profile.TimeSlotsJson) ?? Array.Empty<object>();
                } catch {}

                var socialLinks = new object();
                try {
                    socialLinks = System.Text.Json.JsonSerializer.Deserialize<object>(string.IsNullOrEmpty(profile.SocialLinksJson) ? "{}" : profile.SocialLinksJson) ?? new object();
                } catch {}

                var workingHoursObj = new { days = "Mon - Fri", hours = "9:00 AM - 6:00 PM" };
                if (!string.IsNullOrEmpty(profile.WorkingHours) && profile.WorkingHours.Contains(':'))
                {
                    var parts = profile.WorkingHours.Split(':', 2);
                    workingHoursObj = new { days = parts[0].Trim(), hours = parts[1].Trim() };
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
                    inPersonFee = (double)profile.InPersonFee,
                    casesCompleted = profile.CasesCompleted,
                    successRate = profile.SuccessRate,
                    officeAddress = profile.OfficeAddress,
                    education = profile.Education,
                    languagesSpoken = langArray,
                    isAvailable = profile.IsAvailable,
                    rating = averageRating,
                    avatarUrl = profile.User?.AvatarUrl ?? string.Empty,
                    bannerUrl = profile.BannerUrl ?? string.Empty,
                    // Premium fields
                    activeCourts = courtArray,
                    responseTime = profile.ResponseTime,
                    workingHours = workingHoursObj,
                    socialLinks = socialLinks,
                    faqs = faqs,
                    accolades = accolades,
                    casesList = casesList,
                    availableTimeSlots = timeSlots
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
                            Console.WriteLine($"Sync Success: Lawyer {profile.User?.Email} synchronized successfully.");
                        }
                        else
                        {
                            Console.WriteLine($"Sync Warning: Node.js responded with {response.StatusCode} for {profile.User?.Email}. Retrying...");
                            retries--;
                            if (retries > 0) await Task.Delay(1000);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Sync Attempt Error for {profile.User?.Email}: {ex.Message}. Retrying...");
                        retries--;
                        if (retries > 0) await Task.Delay(1000);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error syncing profile to MongoDB for userId {userId}: {ex.Message}");
            }
        }

        public async Task SyncAllProfilesToMongoAsync()
        {
            try
            {
                var userIds = await _context.LawyerProfiles.Select(p => p.UserId).ToListAsync();
                Console.WriteLine($"Syncing all {userIds.Count} lawyer profiles to MongoDB...");
                
                foreach (var userId in userIds)
                {
                    await SyncProfileToMongoAsync(userId);
                }
                
                Console.WriteLine("All lawyer profiles sync task completed.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error syncing all profiles to MongoDB: {ex.Message}");
            }
        }
    }
}
