using System;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.DTOs;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WhatsAppController : ControllerBase
    {
        private readonly IWhatsAppNotificationService _whatsAppService;
        private readonly AppDbContext _context;
        private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;

        public WhatsAppController(
            IWhatsAppNotificationService whatsAppService,
            AppDbContext context,
            Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _whatsAppService = whatsAppService;
            _context = context;
            _configuration = configuration;
        }

        /// <summary>
        /// Meta Webhook verification handshake (Hub Challenge)
        /// </summary>
        [AllowAnonymous]
        [HttpGet("webhook")]
        public IActionResult VerifyWebhook(
            [FromQuery(Name = "hub.mode")] string? mode,
            [FromQuery(Name = "hub.verify_token")] string? verifyToken,
            [FromQuery(Name = "hub.challenge")] string? challenge)
        {
            var expectedToken = _configuration["WhatsApp:Meta:WebhookVerifyToken"];
            if (string.IsNullOrWhiteSpace(expectedToken))
            {
                return StatusCode(500, new { message = "WhatsApp webhook verification token is not configured on server." });
            }

            if (mode == "subscribe" && verifyToken == expectedToken && !string.IsNullOrEmpty(challenge))
            {
                return Ok(challenge);
            }
            return Forbid();
        }

        /// <summary>
        /// Meta Webhook incoming message / delivery status receiver with HMAC-SHA256 signature verification
        /// </summary>
        [AllowAnonymous]
        [HttpPost("webhook")]
        public async Task<IActionResult> ReceiveWebhook()
        {
            var appSecret = _configuration["WhatsApp:Meta:AppSecret"];
            if (!string.IsNullOrWhiteSpace(appSecret))
            {
                if (!Request.Headers.TryGetValue("X-Hub-Signature-256", out var signatureHeader) || string.IsNullOrWhiteSpace(signatureHeader))
                {
                    return Unauthorized(new { message = "Missing X-Hub-Signature-256 header." });
                }

                string rawBody;
                using (var reader = new System.IO.StreamReader(Request.Body, System.Text.Encoding.UTF8))
                {
                    rawBody = await reader.ReadToEndAsync();
                }

                var headerValue = signatureHeader.ToString();
                var prefix = "sha256=";
                if (!headerValue.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    return Unauthorized(new { message = "Invalid signature format." });
                }

                var hashHex = headerValue.Substring(prefix.Length);
                using var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(appSecret));
                var computedHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(rawBody));
                var computedHex = Convert.ToHexString(computedHash).ToLowerInvariant();

                if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.UTF8.GetBytes(hashHex.ToLowerInvariant()),
                    System.Text.Encoding.UTF8.GetBytes(computedHex)))
                {
                    return Unauthorized(new { message = "Invalid HMAC signature." });
                }
            }
            return Ok(new { status = "received" });
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }

            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return NotFound("User not found.");
            }

            var status = _whatsAppService.GetGatewayStatus(user.WhatsAppPhone ?? user.Phone, user.NotifyWhatsAppEnabled);
            return Ok(status);
        }

        [HttpPost("test")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting(CoreApi.Extensions.RateLimitingExtensions.ProfilePolicyName)]
        public async Task<IActionResult> SendTestAlert([FromBody] SendWhatsAppTestRequestDto? request)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized();
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound("User not found.");
            }

            // Security Hardening: Enforce destination strictly to authenticated user's registered phone
            // to prevent arbitrary SMS/WhatsApp relay abuse and spamming third parties.
            var targetPhone = !string.IsNullOrWhiteSpace(user.WhatsAppPhone) ? user.WhatsAppPhone : user.Phone;

            if (string.IsNullOrWhiteSpace(targetPhone))
            {
                return BadRequest(new { message = "No registered mobile or WhatsApp number found on your profile. Please add your verified number in Profile Settings first." });
            }

            var userName = !string.IsNullOrWhiteSpace(user.FullName) ? user.FullName : "LegalConnect User";
            var result = await _whatsAppService.SendTestAlertAsync(targetPhone, userName);

            return Ok(result);
        }
    }
}