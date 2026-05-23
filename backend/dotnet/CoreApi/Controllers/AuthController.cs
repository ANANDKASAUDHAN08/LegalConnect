using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;

        public AuthController(AppDbContext context, IConfiguration configuration, IEmailService emailService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            {
                return BadRequest("User with this email already exists.");
            }

            var requireVerification = _configuration.GetValue<bool>("Auth:RequireEmailVerification");
            var emailToken = Guid.NewGuid().ToString("N");

            var user = new User
            {
                FullName = request.FullName,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                CreatedAt = DateTime.UtcNow,
                IsEmailVerified = !requireVerification,
                EmailVerificationToken = requireVerification ? emailToken : null
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            if (requireVerification)
            {
                await _emailService.SendVerificationEmailAsync(user.Email, emailToken);
                return Ok(new { message = "User registered successfully! Please check your email to verify your account." });
            }

            return Ok(new { message = "User registered successfully! You can now sign in." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            
            bool isPasswordValid = false;
            if (user != null)
            {
                if (user.PasswordHash.StartsWith("$2a$") || user.PasswordHash.StartsWith("$2b$") || user.PasswordHash.StartsWith("$2y$")) 
                {
                    isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
                }
                else 
                {
                    isPasswordValid = (user.PasswordHash == request.Password);
                }
            }

            if (user == null || !isPasswordValid)
            {
                return Unauthorized("Invalid credentials.");
            }

            var requireVerification = _configuration.GetValue<bool>("Auth:RequireEmailVerification");
            if (requireVerification && !user.IsEmailVerified)
            {
                return BadRequest("Please verify your email address before signing in.");
            }

            var token = CreateToken(user);
            SetTokenCookie(token);

            return Ok(new { token, message = "Logged in successfully!" });
        }

        [Authorize]
        [HttpPost("logout")]
        public IActionResult Logout()
        {
            Response.Cookies.Delete("lc_token", new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax
            });
            return Ok(new { message = "Logged out successfully." });
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail(string token, string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && u.EmailVerificationToken == token);
            if (user == null)
            {
                return BadRequest("Invalid or expired email verification link.");
            }

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Email verified successfully! You can now log in." });
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null)
            {
                // To prevent email enumeration, return a success message regardless of existence.
                return Ok(new { message = "If the email exists, a password reset link has been sent." });
            }

            var resetToken = Guid.NewGuid().ToString("N");
            user.PasswordResetToken = resetToken;
            user.PasswordResetTokenExpires = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            await _emailService.SendPasswordResetEmailAsync(user.Email, resetToken);

            return Ok(new { message = "If the email exists, a password reset link has been sent." });
        }

        [HttpPost("reset-password")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => 
                u.Email == request.Email && 
                u.PasswordResetToken == request.Token && 
                u.PasswordResetTokenExpires > DateTime.UtcNow);

            if (user == null)
            {
                return BadRequest("Invalid or expired password reset link.");
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpires = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password has been reset successfully! You can now log in." });
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim))
            {
                return Unauthorized("User ID claim not found in token.");
            }

            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("Invalid User ID claim.");
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found.");

            return Ok(new
            {
                id = user.Id,
                fullName = user.FullName,
                email = user.Email,
                role = user.Role,
                createdAt = user.CreatedAt
            });
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile(UpdateProfileDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.FullName = request.FullName;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Profile updated successfully!", fullName = user.FullName });
        }

        [Authorize]
        [HttpPut("change-password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            bool isCurrentValid = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash);
            if (!isCurrentValid) return BadRequest("Current password is incorrect.");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password changed successfully!" });
        }

        private void SetTokenCookie(string token)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = DateTime.UtcNow.AddDays(1)
            };
            Response.Cookies.Append("lc_token", token, cookieOptions);
        }

        private string CreateToken(User user)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(ClaimTypes.Name, user.FullName)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                _configuration.GetSection("Jwt:Key").Value!));

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.Now.AddDays(1),
                signingCredentials: creds
            );

            var jwt = new JwtSecurityTokenHandler().WriteToken(token);

            return jwt;
        }
    }
}
