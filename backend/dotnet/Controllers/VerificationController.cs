using System;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.DTOs;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using CoreApi.Utils;

namespace CoreApi.Controllers
{

    [Route("api/verification")]
    [ApiController]
    public class VerificationController : ControllerBase
    {
        private readonly IVerificationService _verificationService;
        private readonly IWhatsAppNotificationService _whatsAppService;
        private readonly IEmailService _emailService;
        private readonly IMemoryCache _memoryCache;
        private readonly AppDbContext _context;
        private readonly ILogger<VerificationController> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public VerificationController(
            IVerificationService verificationService,
            IWhatsAppNotificationService whatsAppService,
            IEmailService emailService,
            IMemoryCache memoryCache,
            AppDbContext context,
            ILogger<VerificationController> logger,
            IServiceScopeFactory serviceScopeFactory)
        {
            _verificationService = verificationService;
            _whatsAppService = whatsAppService;
            _emailService = emailService;
            _memoryCache = memoryCache;
            _context = context;
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
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

        /// <summary>
        /// Legacy Firebase Phone verification endpoint (backward compatible).
        /// </summary>
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

        /// <summary>
        /// Production-grade Phone OTP Dispatch via WhatsApp Cloud API (Primary) with Brevo Email Fallback.
        /// Rate limited to 60s cooldown and max 6 requests/hour.
        /// </summary>
        [Authorize]
        [HttpPost("phone/send-otp")]
        public async Task<IActionResult> SendPhoneOtp([FromBody] SendPhoneOtpDto request)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "User identity could not be verified. Please log in again." });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new { message = "User account not found." });
            }

            if (string.IsNullOrWhiteSpace(request?.Phone))
            {
                return BadRequest(new { message = "A valid phone number is required." });
            }

            var normalizedPhone = NormalizePhoneNumber(request.Phone);
            var channel = (request.Channel ?? "whatsapp").Trim().ToLowerInvariant();

            // 1. Rate Limiting: 60-second cooldown
            var cooldownKey = $"otp_cooldown_{userId}";
            if (_memoryCache.TryGetValue(cooldownKey, out DateTime cooldownUntil))
            {
                var remaining = (int)Math.Ceiling((cooldownUntil - DateTime.UtcNow).TotalSeconds);
                if (remaining > 0)
                {
                    return StatusCode(429, new PhoneOtpResponseDto
                    {
                        IsSuccess = false,
                        Message = $"Please wait {remaining} seconds before requesting another verification code.",
                        CooldownSeconds = remaining,
                        CanFallbackToEmail = true,
                        UserEmail = user.Email
                    });
                }
            }

            // 2. Hourly Abuse Prevention: Maximum 6 OTP dispatches per hour
            var rateLimitKey = $"otp_rate_{userId}";
            _memoryCache.TryGetValue(rateLimitKey, out int hourlyCount);
            if (hourlyCount >= 6)
            {
                return StatusCode(429, new PhoneOtpResponseDto
                {
                    IsSuccess = false,
                    Message = "Too many verification attempts in this hour. For your protection, please wait before trying again.",
                    CooldownSeconds = 300,
                    CanFallbackToEmail = true,
                    UserEmail = user.Email
                });
            }

            // 3. Cryptographically Secure 6-Digit OTP Generation
            var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");

            // 4. Save Session to In-Memory Cache (10 min TTL, 5 attempts allowed)
            var session = new OtpSession
            {
                UserId = userId,
                Phone = normalizedPhone,
                Code = otpCode,
                Channel = channel,
                AttemptsRemaining = 5,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            };

            var sessionKey = $"otp_session_{userId}";
            _memoryCache.Set(sessionKey, session, TimeSpan.FromMinutes(10));
            _memoryCache.Set(cooldownKey, DateTime.UtcNow.AddSeconds(60), TimeSpan.FromSeconds(60));
            _memoryCache.Set(rateLimitKey, hourlyCount + 1, TimeSpan.FromHours(1));

            // 5. Dispatch via Selected Channel
            if (channel == "email")
            {
                try
                {
                    await _emailService.SendOtpEmailAsync(user.Email, otpCode, user.FullName);
                    _logger.LogInformation("[Email OTP] Successfully dispatched code to {Email} for UserId {UserId}", user.Email, userId);
                    return Ok(new PhoneOtpResponseDto
                    {
                        IsSuccess = true,
                        Message = $"Verification code sent to your registered email ({user.Email})!",
                        Channel = "email",
                        TargetPhone = normalizedPhone,
                        CooldownSeconds = 60,
                        CanFallbackToEmail = false,
                        UserEmail = user.Email
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send Email OTP to {Email}", user.Email);
                    return StatusCode(500, new PhoneOtpResponseDto
                    {
                        IsSuccess = false,
                        Message = "Could not send verification code via email. Please try WhatsApp.",
                        CooldownSeconds = 10,
                        CanFallbackToEmail = false,
                        UserEmail = user.Email
                    });
                }
            }

            // Default: WhatsApp Dispatch
            try
            {
                var waResult = await _whatsAppService.SendOtpAlertAsync(normalizedPhone, otpCode, user.FullName);
                _logger.LogInformation("[WhatsApp OTP] Dispatch result for {Phone}: {Success} via {Provider}", normalizedPhone, waResult.IsSuccess, waResult.Provider);

                return Ok(new PhoneOtpResponseDto
                {
                    IsSuccess = true,
                    Message = waResult.IsSuccess
                        ? "Verification code sent to your WhatsApp!"
                        : "WhatsApp message initiated. If you do not receive it shortly, click 'Email OTP' below.",
                    Channel = "whatsapp",
                    TargetPhone = normalizedPhone,
                    CooldownSeconds = 60,
                    DirectWhatsAppUrl = waResult.DirectWhatsAppUrl,
                    CanFallbackToEmail = true,
                    UserEmail = user.Email
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error dispatching WhatsApp OTP to {Phone}", normalizedPhone);
                return Ok(new PhoneOtpResponseDto
                {
                    IsSuccess = true,
                    Message = "WhatsApp service busy. Click below to verify via Email OTP.",
                    Channel = "whatsapp",
                    TargetPhone = normalizedPhone,
                    CooldownSeconds = 30,
                    CanFallbackToEmail = true,
                    UserEmail = user.Email
                });
            }
        }

        /// <summary>
        /// Validates user-submitted 6-digit OTP, updates User.IsPhoneVerified, and activates WhatsApp alerts.
        /// </summary>
        [Authorize]
        [HttpPost("phone/verify-otp")]
        public async Task<IActionResult> VerifyPhoneOtp([FromBody] VerifyPhoneOtpDto request)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "User identity could not be verified." });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound(new { message = "User account not found." });
            }

            var sessionKey = $"otp_session_{userId}";
            if (!_memoryCache.TryGetValue(sessionKey, out OtpSession? session) || session == null)
            {
                return BadRequest(new { message = "Verification code has expired or was not requested. Please request a new code." });
            }

            // Brute force protection: check remaining attempts
            if (session.AttemptsRemaining <= 0)
            {
                _memoryCache.Remove(sessionKey);
                return BadRequest(new { message = "Too many failed attempts. For your security, this code has been revoked. Please request a new code." });
            }

            var submittedCode = (request?.Code ?? "").Trim();
            if (session.Code != submittedCode)
            {
                session.AttemptsRemaining--;
                _memoryCache.Set(sessionKey, session, session.ExpiresAt - DateTime.UtcNow);
                return BadRequest(new { message = $"Incorrect verification code. {session.AttemptsRemaining} attempts remaining." });
            }

            // OTP matches successfully!
            _memoryCache.Remove(sessionKey);
            _memoryCache.Remove($"otp_cooldown_{userId}");

            // Update user profile in database
            user.IsPhoneVerified = true;
            user.Phone = session.Phone;
            user.WhatsAppPhone = session.Phone;
            user.NotifyWhatsAppEnabled = true;
            await _context.SaveChangesAsync();

            _logger.LogInformation("[Phone Verified] User {UserId} ({Email}) verified mobile {Phone}", userId, user.Email, session.Phone);

            // Send confirmation alert via WhatsApp asynchronously with independent DI scope
            var targetPhone = session.Phone;
            var userName = user.FullName;
            _ = Task.Run(async () =>
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var scopedWhatsApp = scope.ServiceProvider.GetRequiredService<IWhatsAppNotificationService>();
                var scopedLogger = scope.ServiceProvider.GetRequiredService<ILogger<VerificationController>>();
                try
                {
                    await scopedWhatsApp.SendTestAlertAsync(targetPhone, userName);
                }
                catch (Exception ex)
                {
                    scopedLogger.LogError(ex, "Failed to send welcome WhatsApp message after verification");
                }
            });

            return Ok(new
            {
                isPhoneVerified = true,
                phone = session.Phone,
                message = "Mobile number verified successfully! WhatsApp legal alerts are now active."
            });
        }

        private static string NormalizePhoneNumber(string phone)
        {
            return PhoneNumberUtils.NormalizeToE164(phone);
        }
    }
}