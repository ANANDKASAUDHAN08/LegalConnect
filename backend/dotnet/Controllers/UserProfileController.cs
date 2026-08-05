using System;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CoreApi.Controllers
{
    [Route("api/profile")]
    [ApiController]
    public class UserProfileController : ControllerBase
    {
        private readonly IUserProfileService _profileService;

        public UserProfileController(IUserProfileService profileService)
        {
            _profileService = profileService;
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim))
            {
                var authResult = await HttpContext.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
                if (authResult.Succeeded && authResult.Principal != null)
                {
                    HttpContext.User = authResult.Principal;
                    userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                }
            }

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Ok(new { isAuthenticated = false });
            }

            var profile = await _profileService.GetProfileAsync(userId);
            if (profile == null) return Ok(new { isAuthenticated = false });

            string? token = Request.Cookies["lc_token"];
            if (string.IsNullOrEmpty(token))
            {
                var authHeader = Request.Headers["Authorization"].ToString();
                if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    token = authHeader.Substring(7);
                }
            }

            return Ok(new
            {
                isAuthenticated = true,
                token = token,
                id = profile.Id,
                fullName = profile.FullName,
                email = profile.Email,
                role = profile.Role,
                createdAt = profile.CreatedAt,
                phone = profile.Phone,
                isPhoneVerified = profile.IsPhoneVerified,
                isEmailVerified = profile.IsEmailVerified,
                isTwoFactorEnabled = profile.IsTwoFactorEnabled,
                clientLanguage = profile.ClientLanguage,
                clientCity = profile.ClientCity,
                clientInterest = profile.ClientInterest,
                dateOfBirth = profile.DateOfBirth,
                gender = profile.Gender,
                addressLine1 = profile.AddressLine1,
                clientState = profile.ClientState,
                clientZip = profile.ClientZip,
                clientBio = profile.ClientBio,
                avatarUrl = profile.AvatarUrl,
                identityStatus = profile.IdentityStatus,
                identityDocumentUrl = profile.IdentityDocumentUrl
            });
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var updated = await _profileService.UpdateProfileAsync(userId, request);
            return Ok(new { message = "Profile updated successfully!", fullName = updated.FullName });
        }

        [Authorize]
        [HttpDelete("me")]
        public async Task<IActionResult> DeleteAccount()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var deleted = await _profileService.DeleteAccountAsync(userId);
            if (!deleted) return NotFound("User not found.");

            Response.Cookies.Delete("lc_token", new CookieOptions { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax });
            Response.Cookies.Delete("__session", new CookieOptions { HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax });

            return Ok(new { message = "Account deleted successfully." });
        }

        [Authorize]
        [HttpPost("verify-identity")]
        public async Task<IActionResult> VerifyIdentity([FromBody] VerifyIdentityDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _profileService.VerifyIdentityAsync(userId, request);
            return Ok(result);
        }

        [Authorize]
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("User ID claim not found.");
            }

            var currentSessionId = User.FindFirst("SessionId")?.Value;
            var sessions = await _profileService.GetActiveSessionsAsync(userId, currentSessionId);
            return Ok(sessions);
        }

        [Authorize]
        [HttpDelete("sessions/{id:int}")]
        public async Task<IActionResult> RevokeSession(int id)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var success = await _profileService.RevokeSessionAsync(userId, id, ip);
            if (!success) return NotFound("Session not found.");
            return Ok(new { message = "Session revoked successfully." });
        }

        [Authorize]
        [HttpDelete("sessions/all")]
        public async Task<IActionResult> RevokeAllOtherSessions()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            await _profileService.RevokeAllSessionsAsync(userId, ip);
            return Ok(new { message = "All sessions revoked." });
        }

        [Authorize]
        [HttpGet("login-history")]
        public async Task<IActionResult> GetLoginHistory()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var history = await _profileService.GetLoginHistoryAsync(userId);
            return Ok(history);
        }

        [Authorize]
        [HttpGet("export-data")]
        public async Task<IActionResult> ExportData()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var fileBytes = await _profileService.ExportUserDataAsync(userId);
            return File(fileBytes, "application/json", "legalconnect_user_data_export.json");
        }

        [Authorize]
        [HttpPut("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] CoreApi.Models.ChangePasswordDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _profileService.ChangePasswordAsync(userId, request);
            if (!result.success) return BadRequest(new { message = result.message });
            return Ok(new { message = result.message });
        }

        [Authorize]
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var settings = await _profileService.GetSettingsAsync(userId);
            if (settings == null) return NotFound("User not found.");
            return Ok(settings);
        }

        [Authorize]
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var success = await _profileService.UpdateSettingsAsync(userId, request);
            if (!success) return NotFound("User not found.");
            return Ok(new { message = "Settings saved successfully!" });
        }

        [Authorize]
        [HttpGet("2fa/setup")]
        public async Task<IActionResult> Get2FaSetup()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var setup = await _profileService.Get2FaSetupAsync(userId);
            if (setup == null) return NotFound("User not found.");
            return Ok(setup);
        }

        [Authorize]
        [HttpPost("2fa/toggle")]
        public async Task<IActionResult> Toggle2Fa([FromBody] Toggle2FaDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _profileService.Toggle2FaAsync(userId, request);
            if (!result.success) return BadRequest(new { message = result.message });
            return Ok(new { isTwoFactorEnabled = result.isTwoFactorEnabled, message = result.message });
        }
    }
}