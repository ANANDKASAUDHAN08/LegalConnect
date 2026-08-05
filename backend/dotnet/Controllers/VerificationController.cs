using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoreApi.Controllers
{
    [Route("api/verification")]
    [ApiController]
    public class VerificationController : ControllerBase
    {
        private readonly IVerificationService _verificationService;

        public VerificationController(IVerificationService verificationService)
        {
            _verificationService = verificationService;
        }

        [HttpGet("email/verify")]
        public async Task<IActionResult> VerifyEmail([FromQuery] string token, [FromQuery] string email)
        {
            var result = await _verificationService.VerifyEmailTokenAsync(email, token);
            if (!result.IsSuccess)
            {
                return BadRequest(new { message = result.Message });
            }
            return Ok(new { message = result.Message, verifiedField = result.VerifiedField, verifiedValue = result.VerifiedValue });
        }

        [HttpPost("email/resend")]
        public async Task<IActionResult> ResendEmailVerification([FromBody] ResendEmailVerificationDto request)
        {
            var result = await _verificationService.ResendEmailVerificationAsync(request.Email);
            if (!result.IsSuccess)
            {
                return BadRequest(new { message = result.Message });
            }
            return Ok(new { message = result.Message });
        }

        [Authorize]
        [HttpPost("phone/verify")]
        public async Task<IActionResult> VerifyPhone([FromBody] VerifyPhoneDto request)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "User ID claim not found or invalid." });
            }

            var result = await _verificationService.VerifyPhoneAsync(userId, request);
            if (!result.IsSuccess)
            {
                return BadRequest(new { message = result.Message });
            }

            return Ok(new
            {
                isPhoneVerified = true,
                phone = result.VerifiedValue,
                message = result.Message
            });
        }
    }
}