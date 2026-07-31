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
        //  LAWYER MANAGEMENT & VERIFICATION QUEUE
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("lawyers")]
        public async Task<IActionResult> GetLawyers(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 10,
            [FromQuery] bool? isVerified = null,
            [FromQuery] string? city = null,
            [FromQuery] string? specialization = null,
            [FromQuery] string? search = null)
        {
            var query = _context.Users
                .AsNoTracking()
                .Include(u => u.LawyerProfile)
                .Where(u => u.Role == "Lawyer");

            if (isVerified.HasValue)
            {
                query = query.Where(u => u.LawyerProfile != null && u.LawyerProfile.IsVerified == isVerified.Value);
            }

            if (!string.IsNullOrWhiteSpace(city))
            {
                query = query.Where(u => u.LawyerProfile != null && u.LawyerProfile.City.Contains(city));
            }

            if (!string.IsNullOrWhiteSpace(specialization))
            {
                query = query.Where(u => u.LawyerProfile != null && u.LawyerProfile.Specialization.Contains(specialization));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.ToLower();
                query = query.Where(u => u.FullName.ToLower().Contains(term) || u.Email.ToLower().Contains(term) || (u.LawyerProfile != null && u.LawyerProfile.BarCouncilNumber.ToLower().Contains(term)));
            }

            var total = await query.CountAsync();
            var lawyers = await query
                .OrderByDescending(u => u.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.Phone,
                    u.IsActive,
                    u.CreatedAt,
                    profile = u.LawyerProfile != null ? new
                    {
                        u.LawyerProfile.BarCouncilNumber,
                        u.LawyerProfile.Specialization,
                        u.LawyerProfile.ExperienceYears,
                        u.LawyerProfile.City,
                        u.LawyerProfile.ConsultationFee,
                        u.LawyerProfile.InPersonFee,
                        u.LawyerProfile.CasesCompleted,
                        u.LawyerProfile.SuccessRate,
                        u.LawyerProfile.IsVerified,
                        u.LawyerProfile.IsAvailable,
                        u.LawyerProfile.OfficeAddress,
                        u.LawyerProfile.Bio
                    } : null
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                data = lawyers,
                pagination = new
                {
                    page,
                    limit,
                    total,
                    pages = (int)Math.Ceiling((double)total / limit)
                }
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("lawyers/{id}")]
        public async Task<IActionResult> GetLawyerDetail(int id)
        {
            var user = await _context.Users.Include(u => u.LawyerProfile).FirstOrDefaultAsync(u => u.Id == id && u.Role == "Lawyer");
            if (user == null || user.LawyerProfile == null)
            {
                return NotFound(new { message = "Lawyer profile not found." });
            }

            var reviews = await _context.Reviews.Where(r => r.TargetName.Contains(user.FullName)).ToListAsync();
            var consultationCount = await _context.Consultations.CountAsync(c => c.LawyerId == id);

            return Ok(new
            {
                success = true,
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Email,
                    user.Phone,
                    user.IsActive,
                    user.CreatedAt,
                    profile = new
                    {
                        user.LawyerProfile.BarCouncilNumber,
                        user.LawyerProfile.Specialization,
                        user.LawyerProfile.ExperienceYears,
                        user.LawyerProfile.City,
                        user.LawyerProfile.ConsultationFee,
                        user.LawyerProfile.InPersonFee,
                        user.LawyerProfile.CasesCompleted,
                        user.LawyerProfile.SuccessRate,
                        user.LawyerProfile.IsVerified,
                        user.LawyerProfile.IsAvailable,
                        user.LawyerProfile.OfficeAddress,
                        user.LawyerProfile.Bio
                    }
                },
                stats = new
                {
                    reviewCount = reviews.Count,
                    avgRating = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : 0.0,
                    consultationCount
                }
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("lawyers/{id}/verify")]
        public async Task<IActionResult> ToggleLawyerVerification(int id, [FromBody] AdminVerifyLawyerDto dto)
        {
            var user = await _context.Users.Include(u => u.LawyerProfile).FirstOrDefaultAsync(u => u.Id == id && u.Role == "Lawyer");
            if (user == null || user.LawyerProfile == null)
            {
                return NotFound(new { message = "Lawyer profile not found." });
            }

            user.LawyerProfile.IsVerified = dto.IsVerified;
            user.LawyerProfile.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Sync verification state to MongoDB
            try
            {
                await _syncService.SyncProfileToMongoAsync(user.Id);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Mongo sync warning: {ex.Message}");
            }

            return Ok(new { success = true, message = dto.IsVerified ? "Lawyer verified successfully." : "Lawyer verification revoked.", isVerified = dto.IsVerified });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("lawyers/{id}/profile")]
        public async Task<IActionResult> UpdateLawyerProfile(int id, [FromBody] AdminUpdateLawyerProfileDto dto)
        {
            var user = await _context.Users.Include(u => u.LawyerProfile).FirstOrDefaultAsync(u => u.Id == id && u.Role == "Lawyer");
            if (user == null || user.LawyerProfile == null)
            {
                return NotFound(new { message = "Lawyer profile not found." });
            }

            if (dto.BarCouncilNumber != null) user.LawyerProfile.BarCouncilNumber = dto.BarCouncilNumber;
            if (dto.Specialization != null) user.LawyerProfile.Specialization = dto.Specialization;
            if (dto.ExperienceYears.HasValue) user.LawyerProfile.ExperienceYears = dto.ExperienceYears.Value;
            if (dto.City != null) user.LawyerProfile.City = dto.City;
            if (dto.ConsultationFee.HasValue) user.LawyerProfile.ConsultationFee = dto.ConsultationFee.Value;
            if (dto.InPersonFee.HasValue) user.LawyerProfile.InPersonFee = dto.InPersonFee.Value;
            if (dto.OfficeAddress != null) user.LawyerProfile.OfficeAddress = dto.OfficeAddress;
            if (dto.Bio != null) user.LawyerProfile.Bio = dto.Bio;
            if (dto.IsAvailable.HasValue) user.LawyerProfile.IsAvailable = dto.IsAvailable.Value;
            if (dto.IsVerified.HasValue) user.LawyerProfile.IsVerified = dto.IsVerified.Value;

            user.LawyerProfile.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Sync to MongoDB
            try
            {
                await _syncService.SyncProfileToMongoAsync(user.Id);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Mongo sync warning: {ex.Message}");
            }

            return Ok(new { success = true, message = "Lawyer profile updated." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("lawyers/bulk-verify")]
        public async Task<IActionResult> BulkVerifyLawyers([FromBody] AdminBulkVerifyLawyersDto dto)
        {
            if (dto.LawyerIds == null || !dto.LawyerIds.Any())
            {
                return BadRequest(new { message = "No lawyer IDs provided." });
            }

            var lawyers = await _context.Users
                .Include(u => u.LawyerProfile)
                .Where(u => dto.LawyerIds.Contains(u.Id) && u.Role == "Lawyer" && u.LawyerProfile != null)
                .ToListAsync();

            foreach (var l in lawyers)
            {
                if (l.LawyerProfile != null)
                {
                    l.LawyerProfile.IsVerified = dto.IsVerified;
                    l.LawyerProfile.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            // Background MongoDB sync for all updated lawyers
            _ = Task.Run(async () =>
            {
                foreach (var l in lawyers)
                {
                    try
                    {
                        await _syncService.SyncProfileToMongoAsync(l.Id);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Bulk Mongo sync warning for Lawyer #{l.Id}: {ex.Message}");
                    }
                }
            });

            return Ok(new { success = true, message = $"Bulk verification status updated to {dto.IsVerified} for {lawyers.Count} advocate(s)." });
        }
    }

    public class AdminBulkVerifyLawyersDto
    {
        public System.Collections.Generic.List<int> LawyerIds { get; set; } = new();
        public bool IsVerified { get; set; }
    }
}
