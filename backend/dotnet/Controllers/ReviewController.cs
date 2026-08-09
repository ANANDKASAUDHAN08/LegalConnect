using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CoreApi.Services;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ReviewController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILawyerSyncService _syncService;

        // In-memory rate limiter: key = "IP:reviewId", value = last action UTC
        private static readonly ConcurrentDictionary<string, DateTime> _likeRateLimit = new();
        private static readonly TimeSpan _likeCooldown = TimeSpan.FromSeconds(60);

        public ReviewController(AppDbContext context, ILawyerSyncService syncService)
        {
            _context = context;
            _syncService = syncService;
        }

        [HttpGet]
        public async Task<IActionResult> GetReviews(
            [FromQuery] string? targetName,
            [FromQuery] int page = 1,
            [FromQuery] int limit = 12)
        {
            try
            {
                var query = _context.Reviews.AsNoTracking().AsQueryable();

                // Public endpoint ONLY returns Approved or unset moderation status reviews
                query = query.Where(r => r.ModerationStatus == "Approved" || string.IsNullOrEmpty(r.ModerationStatus));

                if (!string.IsNullOrEmpty(targetName))
                {
                    query = query.Where(r => r.TargetName == targetName);
                }

                var total = await query.CountAsync();
                var pages = (int)Math.Ceiling((double)total / limit);
                if (pages < 1) pages = 1;

                var reviews = await query
                    .OrderByDescending(r => r.CreatedAt)
                    .Skip((page - 1) * limit)
                    .Take(limit)
                    .ToListAsync();

                // Substitute redacted content for public display if redacted text exists
                foreach (var r in reviews)
                {
                    if (!string.IsNullOrEmpty(r.RedactedContent))
                    {
                        r.Content = r.RedactedContent;
                    }
                }

                return Ok(new { data = reviews, pagination = new { total, page, limit, pages } });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GetReviews error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to fetch reviews." });
            }
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetReviewStats([FromQuery] string? targetName)
        {
            try
            {
                var query = _context.Reviews.AsNoTracking().Where(r => r.ModerationStatus == "Approved" || string.IsNullOrEmpty(r.ModerationStatus));

                if (!string.IsNullOrEmpty(targetName))
                {
                    query = query.Where(r => r.TargetName == targetName);
                }

                var total = await query.CountAsync();
                if (total == 0)
                {
                    return Ok(new
                    {
                        totalReviews = 0,
                        averageRating = 5.0,
                        verifiedCount = 0,
                        distribution = new Dictionary<string, int> { { "5", 0 }, { "4", 0 }, { "3", 0 }, { "2", 0 }, { "1", 0 } }
                    });
                }

                var average = await query.AverageAsync(r => r.Rating);
                var verifiedCount = await query.CountAsync(r => r.ConsultationId.HasValue);

                var distribution = await query
                    .GroupBy(r => r.Rating)
                    .Select(g => new { Rating = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(g => g.Rating.ToString(), g => g.Count);

                for (int i = 1; i <= 5; i++)
                {
                    if (!distribution.ContainsKey(i.ToString()))
                    {
                        distribution[i.ToString()] = 0;
                    }
                }

                return Ok(new
                {
                    totalReviews = total,
                    averageRating = Math.Round(average, 1),
                    verifiedCount = verifiedCount,
                    distribution = distribution
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GetReviewStats error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to calculate review statistics." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddReview([FromBody] CreateReviewDto dto)
        {
            try
            {
                if (dto.Rating < 1 || dto.Rating > 5)
                {
                    return BadRequest("Rating must be between 1 and 5.");
                }

                if (string.IsNullOrWhiteSpace(dto.Content))
                {
                    return BadRequest("Content cannot be empty.");
                }

                var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();

                var review = new Review
                {
                    Rating = dto.Rating,
                    Content = dto.Content.Trim(),
                    TargetName = string.IsNullOrWhiteSpace(dto.TargetName) ? "Platform" : dto.TargetName.Trim(),
                    IPAddress = clientIp,
                    CreatedAt = DateTime.UtcNow
                };

                // Check if user is authenticated (using JWT cookie)
                var isAuthenticated = User.Identity?.IsAuthenticated ?? false;
                if (isAuthenticated)
                {
                    var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                    if (userIdClaim != null && int.TryParse(userIdClaim, out int userId))
                    {
                        var user = await _context.Users.FindAsync(userId);
                        if (user != null)
                        {
                            review.AuthorName = user.FullName;
                            review.UserRole = user.Role; // Client or Lawyer
                            review.UserId = user.Id;

                            // Validate actual completed consultation link for Verified Client status
                            if (!string.Equals(review.TargetName, "Platform", StringComparison.OrdinalIgnoreCase))
                            {
                                var matchingConsultation = await _context.Consultations
                                    .FirstOrDefaultAsync(c => c.ClientId == userId &&
                                                         c.Lawyer != null &&
                                                         c.Lawyer.FullName == review.TargetName &&
                                                         c.Status == "completed");
                                if (matchingConsultation != null)
                                {
                                    review.IsVerifiedClient = true;
                                    review.ConsultationId = matchingConsultation.Id;
                                }
                            }
                        }
                    }
                }

                // Fallback for Guest reviews
                if (string.IsNullOrEmpty(review.AuthorName))
                {
                    review.AuthorName = string.IsNullOrWhiteSpace(dto.AuthorName) ? "Anonymous Guest" : dto.AuthorName.Trim();
                    review.UserRole = "Guest";
                }

                _context.Reviews.Add(review);
                await _context.SaveChangesAsync();
                await SyncLawyerRatingToMongo(review.TargetName);

                return Ok(review);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"AddReview error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to submit review." });
            }
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateReview(int id, [FromBody] UpdateReviewDto dto)
        {
            try
            {
                if (dto.Rating < 1 || dto.Rating > 5)
                {
                    return BadRequest("Rating must be between 1 and 5.");
                }

                if (string.IsNullOrWhiteSpace(dto.Content))
                {
                    return BadRequest("Content cannot be empty.");
                }

                var review = await _context.Reviews.FindAsync(id);
                if (review == null)
                {
                    return NotFound("Review not found.");
                }

                // Check authorization ownership
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim, out int currentUserId) || review.UserId != currentUserId)
                {
                    return Forbid("You do not have permission to modify this review.");
                }

                // Track edit history
                if (string.IsNullOrEmpty(review.OriginalContent))
                {
                    review.OriginalContent = review.Content;
                }
                review.LastEditedAt = DateTime.UtcNow;
                review.Rating = dto.Rating;
                review.Content = dto.Content.Trim();
                review.TargetName = string.IsNullOrWhiteSpace(dto.TargetName) ? "Platform" : dto.TargetName.Trim();

                await _context.SaveChangesAsync();
                await SyncLawyerRatingToMongo(review.TargetName);
                return Ok(review);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"UpdateReview error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update review." });
            }
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteReview(int id)
        {
            try
            {
                var review = await _context.Reviews.FindAsync(id);
                if (review == null)
                {
                    return NotFound("Review not found.");
                }

                // Check authorization ownership
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim, out int currentUserId) || review.UserId != currentUserId)
                {
                    return Forbid("You do not have permission to delete this review.");
                }

                _context.Reviews.Remove(review);
                await _context.SaveChangesAsync();
                await SyncLawyerRatingToMongo(review.TargetName);
                return Ok(new { message = "Review deleted successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DeleteReview error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete review." });
            }
        }

        [HttpPost("{id}/like")]
        public async Task<IActionResult> LikeReview(int id)
        {
            try
            {
                var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var rateKey = $"{clientIp}:{id}";
                if (_likeRateLimit.TryGetValue(rateKey, out var lastAction) && DateTime.UtcNow - lastAction < _likeCooldown)
                {
                    return StatusCode(429, new { message = "Rate limit exceeded. Please wait before toggling again." });
                }

                var review = await _context.Reviews.FindAsync(id);
                if (review == null)
                {
                    return NotFound("Review not found.");
                }

                review.Likes += 1;
                await _context.SaveChangesAsync();
                _likeRateLimit[rateKey] = DateTime.UtcNow;

                return Ok(review);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"LikeReview error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to process like action." });
            }
        }

        [HttpPost("{id}/unlike")]
        public async Task<IActionResult> UnlikeReview(int id)
        {
            try
            {
                var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var rateKey = $"{clientIp}:{id}";
                if (_likeRateLimit.TryGetValue(rateKey, out var lastAction) && DateTime.UtcNow - lastAction < _likeCooldown)
                {
                    return StatusCode(429, new { message = "Rate limit exceeded. Please wait before toggling again." });
                }

                var review = await _context.Reviews.FindAsync(id);
                if (review == null)
                {
                    return NotFound("Review not found.");
                }

                if (review.Likes > 0)
                {
                    review.Likes -= 1;
                }
                await _context.SaveChangesAsync();
                _likeRateLimit[rateKey] = DateTime.UtcNow;

                return Ok(review);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"UnlikeReview error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to process unlike action." });
            }
        }

        [HttpPost("{id}/flag")]
        public async Task<IActionResult> FlagReview(int id, [FromBody] FlagReviewDto dto)
        {
            try
            {
                var review = await _context.Reviews.FindAsync(id);
                if (review == null)
                {
                    return NotFound(new { message = "Review not found." });
                }

                review.ModerationStatus = "Flagged";
                review.FlagReason = string.IsNullOrWhiteSpace(dto.Reason) ? "Flagged by community user" : dto.Reason.Trim();
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Review flagged to moderation desk for audit." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"FlagReview error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to flag review." });
            }
        }

        [Authorize]
        [HttpPost("{id}/dispute")]
        public async Task<IActionResult> SubmitDispute(int id, [FromBody] DisputeReviewDto dto)
        {
            try
            {
                var review = await _context.Reviews.FindAsync(id);
                if (review == null)
                {
                    return NotFound(new { message = "Review not found." });
                }

                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized("Invalid user authentication.");
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null || !user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid("Only target advocates can submit review removal disputes.");
                }

                review.IsDisputeRequested = true;
                review.DisputeReason = string.IsNullOrWhiteSpace(dto.Reason) ? "Advocate requested removal review" : dto.Reason.Trim();
                review.DisputeRequestedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Ok(new { success = true, message = "Dispute request submitted to moderation team." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"SubmitDispute error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to submit dispute." });
            }
        }

        [Authorize]
        [HttpGet("mine")]
        public async Task<IActionResult> GetMyReviews()
        {
            try
            {
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized("Invalid user identification.");
                }

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return NotFound("User not found.");

                if (user.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
                {
                    var reviews = await _context.Reviews
                        .AsNoTracking()
                        .Where(r => r.TargetName == user.FullName)
                        .OrderByDescending(r => r.CreatedAt)
                        .ToListAsync();
                    return Ok(reviews);
                }
                else
                {
                    var reviews = await _context.Reviews
                        .AsNoTracking()
                        .Where(r => r.UserId == userId)
                        .OrderByDescending(r => r.CreatedAt)
                        .ToListAsync();
                    return Ok(reviews);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GetMyReviews error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to fetch user reviews." });
            }
        }

        private async Task SyncLawyerRatingToMongo(string targetName)
        {
            if (string.IsNullOrEmpty(targetName) || targetName == "Platform") return;

            try
            {
                var profile = await _context.LawyerProfiles
                    .Include(p => p.User)
                    .FirstOrDefaultAsync(p => p.User != null && p.User.FullName == targetName);

                if (profile != null)
                {
                    await _syncService.SyncProfileToMongoAsync(profile.UserId);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error syncing rating to MongoDB: {ex.Message}");
            }
        }
    }

    public class CreateReviewDto
    {
        public int Rating { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? TargetName { get; set; }
        public string? AuthorName { get; set; } // Only utilized for Guests
    }

    public class UpdateReviewDto
    {
        public int Rating { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? TargetName { get; set; }
    }

    public class FlagReviewDto
    {
        public string? Reason { get; set; }
    }

    public class DisputeReviewDto
    {
        public string? Reason { get; set; }
    }
}