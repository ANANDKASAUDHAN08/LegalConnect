using System;
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
    public class ReviewController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReviewController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetReviews()
        {
            try
            {
                var reviews = await _context.Reviews
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();
                return Ok(reviews);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
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

                var review = new Review
                {
                    Rating = dto.Rating,
                    Content = dto.Content,
                    TargetName = string.IsNullOrWhiteSpace(dto.TargetName) ? "Platform" : dto.TargetName.Trim(),
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

                return Ok(review);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
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

                review.Rating = dto.Rating;
                review.Content = dto.Content;
                review.TargetName = string.IsNullOrWhiteSpace(dto.TargetName) ? "Platform" : dto.TargetName.Trim();

                await _context.SaveChangesAsync();
                return Ok(review);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
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
                return Ok(new { message = "Review deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("{id}/like")]
        public async Task<IActionResult> LikeReview(int id)
        {
            try
            {
                var review = await _context.Reviews.FindAsync(id);
                if (review == null)
                {
                    return NotFound("Review not found.");
                }

                review.Likes += 1;
                await _context.SaveChangesAsync();

                return Ok(review);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("{id}/unlike")]
        public async Task<IActionResult> UnlikeReview(int id)
        {
            try
            {
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

                return Ok(review);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
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
}
