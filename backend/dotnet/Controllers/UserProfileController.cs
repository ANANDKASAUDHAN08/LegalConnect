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
using Microsoft.AspNetCore.RateLimiting;
using CoreApi.Extensions;

namespace CoreApi.Controllers
{
    [Route("api/profile")]
    [ApiController]
    public class UserProfileController : ControllerBase
    {
        private readonly IUserProfileService _profileService;
        private readonly ITokenService _tokenService;

        public UserProfileController(IUserProfileService profileService, ITokenService tokenService)
        {
            _profileService = profileService;
            _tokenService = tokenService;
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
                return Unauthorized(new { isAuthenticated = false, message = "Authentication required." });
            }

            var profile = await _profileService.GetProfileAsync(userId);
            if (profile == null) return Unauthorized(new { isAuthenticated = false, message = "Profile not found." });

            return Ok(new
            {
                isAuthenticated = true,
                id = profile.Id,
                publicId = profile.PublicId,
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
                clientState = profile.ClientState,
                clientBio = profile.ClientBio,
                avatarUrl = profile.AvatarUrl,
                dateOfBirth = profile.DateOfBirth,
                gender = profile.Gender,
                notifyWhatsAppEnabled = profile.NotifyWhatsAppEnabled,
                whatsAppPhone = profile.WhatsAppPhone,
                isSearchIndexable = profile.IsSearchIndexable
            });
        }

        private bool TryGetUserId(out int userId)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(userIdClaim, out userId);
        }

        [Authorize]
        [HttpPut("me")]
        [EnableRateLimiting(RateLimitingExtensions.ProfilePolicyName)]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto request)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var updated = await _profileService.UpdateProfileAsync(userId, request);
            return Ok(new
            {
                message = "Profile updated successfully!",
                fullName = updated.FullName,
                profile = updated
            });
        }

        [Authorize]
        [HttpDelete("me")]
        public async Task<IActionResult> DeleteAccount()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var deleted = await _profileService.DeleteAccountAsync(userId);
            if (!deleted) return NotFound("User not found.");

            // M-02: Clear auth cookies using matching browser-compatible options
            _tokenService.ClearAuthCookies(Response);

            return Ok(new { message = "Account deleted successfully." });
        }

        [Authorize]
        [HttpPost("deactivate")]
        public async Task<IActionResult> DeactivateAccount()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var success = await _profileService.DeactivateAccountAsync(userId);
            if (!success) return NotFound("User not found.");

            _tokenService.ClearAuthCookies(Response);
            return Ok(new { message = "Account deactivated successfully." });
        }

        [Authorize]
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");

            var currentSessionId = User.FindFirst("SessionId")?.Value;
            var sessions = await _profileService.GetActiveSessionsAsync(userId, currentSessionId);
            return Ok(sessions);
        }

        [Authorize]
        [HttpDelete("sessions/{id:int}")]
        public async Task<IActionResult> RevokeSession(int id)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var success = await _profileService.RevokeSessionAsync(userId, id, ip);
            if (!success) return NotFound("Session not found.");
            return Ok(new { message = "Session revoked successfully." });
        }

        [Authorize]
        [HttpDelete("sessions/all")]
        public async Task<IActionResult> RevokeAllOtherSessions()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            await _profileService.RevokeAllSessionsAsync(userId, ip);
            return Ok(new { message = "All sessions revoked." });
        }

        [Authorize]
        [HttpGet("login-history")]
        public async Task<IActionResult> GetLoginHistory()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var history = await _profileService.GetLoginHistoryAsync(userId);
            return Ok(history);
        }

        [Authorize]
        [HttpGet("export-data")]
        public async Task<IActionResult> ExportData()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var fileBytes = await _profileService.ExportUserDataAsync(userId);
            return File(fileBytes, "application/json", "legalconnect_user_data_export.json");
        }

        [Authorize]
        [HttpPut("change-password")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto request)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var result = await _profileService.ChangePasswordAsync(userId, request);
            if (!result.success) return BadRequest(new { message = result.message });
            return Ok(new { message = result.message });
        }

        [Authorize]
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var settings = await _profileService.GetSettingsAsync(userId);
            if (settings == null) return NotFound("User not found.");
            return Ok(settings);
        }

        [Authorize]
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsDto request)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var success = await _profileService.UpdateSettingsAsync(userId, request);
            if (!success) return NotFound("User not found.");
            return Ok(new { message = "Settings saved successfully!" });
        }

        [Authorize]
        [HttpGet("2fa/setup")]
        public async Task<IActionResult> Get2FaSetup([FromQuery] bool force = false)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var setup = await _profileService.Get2FaSetupAsync(userId, force);
            if (setup == null) return NotFound("User not found.");
            return Ok(setup);
        }

        [Authorize]
        [EnableRateLimiting("AuthPolicy")]
        [HttpPost("2fa/toggle")]
        public async Task<IActionResult> Toggle2Fa([FromBody] Toggle2FaDto request)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var result = await _profileService.Toggle2FaAsync(userId, request);
            if (!result.success) return BadRequest(new { message = result.message });
            return Ok(new { isTwoFactorEnabled = result.isTwoFactorEnabled, message = result.message });
        }

        [Authorize]
        [EnableRateLimiting("AuthPolicy")]
        [HttpPost("2fa/reconfigure")]
        public async Task<IActionResult> Reconfigure2Fa([FromBody] ReconfigureDto request)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var result = await _profileService.Reconfigure2FaAsync(userId, request.Password);
            if (result == null) return BadRequest(new { message = "Invalid password or 2FA is not enabled." });
            return Ok(result);
        }

        [Authorize]
        [HttpPost("2fa/reconfigure/cancel")]
        public IActionResult CancelReconfigure2Fa()
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            _profileService.CancelReconfigure2Fa(userId);
            return Ok(new { message = "Reconfiguration cancelled. Your active authenticator remains unchanged." });
        }

        [Authorize]
        [EnableRateLimiting("AuthPolicy")]
        [HttpPost("2fa/backup-codes")]
        public async Task<IActionResult> GetBackupCodes([FromBody] PasswordConfirmDto request)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var result = await _profileService.GetBackupCodesAsync(userId, request.Password);
            if (result == null) return BadRequest(new { message = "Invalid password or 2FA is not enabled." });
            return Ok(result);
        }

        [Authorize]
        [EnableRateLimiting("AuthPolicy")]
        [HttpPost("2fa/backup-codes/regenerate")]
        public async Task<IActionResult> RegenerateBackupCodes([FromBody] PasswordConfirmDto request)
        {
            if (!TryGetUserId(out int userId)) return Unauthorized("User identity could not be verified.");
            var result = await _profileService.RegenerateBackupCodesAsync(userId, request.Password);
            if (result == null) return BadRequest(new { message = "Invalid password or 2FA is not enabled." });
            return Ok(result);
        }
    }
}