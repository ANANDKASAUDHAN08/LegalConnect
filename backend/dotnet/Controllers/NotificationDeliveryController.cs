using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.DTOs;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoreApi.Controllers
{
    [ApiController]
    [Route("api/notification-delivery")]
    public class NotificationDeliveryController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEmailService _emailService;
        private readonly IWhatsAppNotificationService _whatsAppService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<NotificationDeliveryController> _logger;

        public NotificationDeliveryController(
            AppDbContext context,
            IEmailService emailService,
            IWhatsAppNotificationService whatsAppService,
            IConfiguration configuration,
            ILogger<NotificationDeliveryController> logger)
        {
            _context = context;
            _emailService = emailService;
            _whatsAppService = whatsAppService;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Internal endpoint: Fans out a notification to external delivery channels (Email, WhatsApp)
        /// based on user preferences and Quiet Hours evaluation.
        /// </summary>
        [HttpPost("dispatch")]
        public async Task<IActionResult> DispatchNotification([FromBody] NotificationDispatchRequestDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.RecipientUserId))
            {
                return BadRequest(new { message = "RecipientUserId and dispatch payload are required." });
            }

            var user = await FindUserAsync(dto.RecipientUserId);
            if (user == null)
            {
                _logger.LogWarning("[NotificationDelivery] User '{UserId}' not found for dispatch.", dto.RecipientUserId);
                return Ok(new NotificationDispatchResultDto
                {
                    QuietHoursActive = false,
                    Results = new List<ChannelDeliveryResultDto>
                    {
                        new()
                        {
                            Channel = "all",
                            Status = "skipped",
                            Reason = $"Recipient '{dto.RecipientUserId}' not found in user registry."
                        }
                    }
                });
            }

            // Evaluate Quiet Hours (Do-Not-Disturb)
            bool isQuietHoursActive = false;
            if (dto.QuietHours != null && dto.QuietHours.Enabled)
            {
                isQuietHoursActive = IsCurrentTimeInWindow(
                    dto.QuietHours.StartTime,
                    dto.QuietHours.EndTime,
                    user.PreferredTimezone ?? "Asia/Kolkata");
            }

            bool bypassQuietHours = isQuietHoursActive &&
                                   (dto.QuietHours?.AllowUrgent ?? true) &&
                                   dto.Priority.Equals("urgent", StringComparison.OrdinalIgnoreCase);

            var dispatchResult = new NotificationDispatchResultDto
            {
                QuietHoursActive = isQuietHoursActive && !bypassQuietHours
            };

            // If Quiet Hours is suppressing alerts, mark channels as quiet-suppressed
            if (isQuietHoursActive && !bypassQuietHours)
            {
                _logger.LogInformation(
                    "[NotificationDelivery] Alert '{Title}' suppressed by Quiet Hours for user {User}",
                    dto.Title, user.Email);

                if (dto.Email)
                {
                    dispatchResult.Results.Add(new ChannelDeliveryResultDto
                    {
                        Channel = "email",
                        Status = "skipped",
                        Reason = "Suppressed: recipient is currently in scheduled Quiet Hours.",
                        Target = MaskEmail(user.Email)
                    });
                }
                if (dto.WhatsApp)
                {
                    dispatchResult.Results.Add(new ChannelDeliveryResultDto
                    {
                        Channel = "whatsapp",
                        Status = "skipped",
                        Reason = "Suppressed: recipient is currently in scheduled Quiet Hours.",
                        Target = MaskPhone(user.WhatsAppPhone ?? user.Phone)
                    });
                }
                return Ok(dispatchResult);
            }

            // 1. Dispatch Email
            if (dto.Email)
            {
                if (!string.IsNullOrWhiteSpace(user.Email))
                {
                    try
                    {
                        var emailResult = await _emailService.SendNotificationEmailAsync(
                            user.Email,
                            !string.IsNullOrWhiteSpace(user.FullName) ? user.FullName : "LegalConnect User",
                            dto.Title,
                            dto.Summary,
                            dto.Details,
                            dto.ActionUrl,
                            dto.ActionLabel,
                            dto.Priority);

                        dispatchResult.Results.Add(new ChannelDeliveryResultDto
                        {
                            Channel = "email",
                            Status = emailResult.IsSimulated ? "simulated" : "sent",
                            Provider = emailResult.Provider,
                            Target = MaskEmail(user.Email)
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[NotificationDelivery] Failed to dispatch email to {Email}", user.Email);
                        dispatchResult.Results.Add(new ChannelDeliveryResultDto
                        {
                            Channel = "email",
                            Status = "failed",
                            Reason = ex.Message,
                            Target = MaskEmail(user.Email)
                        });
                    }
                }
                else
                {
                    dispatchResult.Results.Add(new ChannelDeliveryResultDto
                    {
                        Channel = "email",
                        Status = "skipped",
                        Reason = "No registered email address on profile."
                    });
                }
            }

            // 2. Dispatch WhatsApp
            if (dto.WhatsApp)
            {
                var targetPhone = !string.IsNullOrWhiteSpace(user.WhatsAppPhone) ? user.WhatsAppPhone : user.Phone;
                if (!string.IsNullOrWhiteSpace(targetPhone))
                {
                    try
                    {
                        var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
                        var actionLink = !string.IsNullOrWhiteSpace(dto.ActionUrl)
                            ? (dto.ActionUrl.StartsWith("http") ? dto.ActionUrl : $"{appUrl}{dto.ActionUrl}")
                            : $"{appUrl}/notifications";

                        var waMessage =
                            $"*[LEGALCONNECT]* {dto.Title}\n\n" +
                            $"{dto.Summary}\n" +
                            (!string.IsNullOrWhiteSpace(dto.Details) ? $"\n_{dto.Details}_\n" : "") +
                            $"\nView in Portal: {actionLink}\n" +
                            $"Priority: *{dto.Priority.ToUpperInvariant()}*";

                        var waResult = await _whatsAppService.SendAlertAsync(targetPhone, waMessage, dto.Type);

                        dispatchResult.Results.Add(new ChannelDeliveryResultDto
                        {
                            Channel = "whatsapp",
                            Status = waResult.IsSimulated ? "simulated" : (waResult.IsSuccess ? "sent" : "failed"),
                            Provider = waResult.Provider,
                            Target = MaskPhone(targetPhone),
                            DirectUrl = waResult.DirectWhatsAppUrl,
                            Reason = waResult.ErrorDetails
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[NotificationDelivery] Failed to dispatch WhatsApp to {Phone}", targetPhone);
                        dispatchResult.Results.Add(new ChannelDeliveryResultDto
                        {
                            Channel = "whatsapp",
                            Status = "failed",
                            Reason = ex.Message,
                            Target = MaskPhone(targetPhone)
                        });
                    }
                }
                else
                {
                    dispatchResult.Results.Add(new ChannelDeliveryResultDto
                    {
                        Channel = "whatsapp",
                        Status = "skipped",
                        Reason = "No registered phone number on profile."
                    });
                }
            }

            return Ok(dispatchResult);
        }

        /// <summary>
        /// Sends an authentic live test notification to the authenticated user's chosen channel (email or whatsapp).
        /// </summary>
        [HttpPost("test-channel")]
        [Authorize]
        public async Task<IActionResult> TestChannel([FromBody] NotificationTestDeliveryRequestDto request)
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

            var channel = (request?.Channel ?? "email").ToLowerInvariant().Trim();

            if (channel == "whatsapp")
            {
                var targetPhone = !string.IsNullOrWhiteSpace(user.WhatsAppPhone) ? user.WhatsAppPhone : user.Phone;
                if (string.IsNullOrWhiteSpace(targetPhone))
                {
                    return BadRequest(new
                    {
                        message = "No registered mobile or WhatsApp number found on your profile. Please configure your number in Profile Settings first."
                    });
                }

                var userName = !string.IsNullOrWhiteSpace(user.FullName) ? user.FullName : "LegalConnect User";
                var result = await _whatsAppService.SendTestAlertAsync(targetPhone, userName);

                return Ok(new
                {
                    success = result.IsSuccess,
                    channel = "whatsapp",
                    provider = result.Provider,
                    isSimulated = result.IsSimulated,
                    target = MaskPhone(targetPhone),
                    rawTarget = targetPhone,
                    directUrl = result.DirectWhatsAppUrl,
                    message = result.IsSimulated
                        ? $"WhatsApp simulation ready for {MaskPhone(targetPhone)}. Direct deep link generated."
                        : $"Real WhatsApp test alert successfully dispatched to {MaskPhone(targetPhone)}."
                });
            }
            else
            {
                // Email test
                if (string.IsNullOrWhiteSpace(user.Email))
                {
                    return BadRequest(new { message = "No registered email found on your profile." });
                }

                var userName = !string.IsNullOrWhiteSpace(user.FullName) ? user.FullName : "LegalConnect User";
                var emailResult = await _emailService.SendNotificationEmailAsync(
                    user.Email,
                    userName,
                    "Channel Verification Test Alert",
                    "This is a verified test dispatch from LegalConnect confirming that your notification routing is operational.",
                    "All preferences configured on your account (Statutory Acts, Court Hearing Dockets, Confidential Direct Inquiries) will arrive via this verified channel.",
                    "/notifications",
                    "Open Notifications Center",
                    "normal");

                return Ok(new
                {
                    success = emailResult.IsSuccess,
                    channel = "email",
                    provider = emailResult.Provider,
                    isSimulated = emailResult.IsSimulated,
                    target = MaskEmail(user.Email),
                    message = emailResult.IsSimulated
                        ? $"Email notification logged to server telemetry for {MaskEmail(user.Email)} (Development mode)."
                        : $"Real notification email successfully dispatched to {MaskEmail(user.Email)}."
                });
            }
        }

        /// <summary>
        /// Returns live delivery gateway and destination status for the authenticated user.
        /// </summary>
        [HttpGet("delivery-status")]
        [Authorize]
        public async Task<IActionResult> GetDeliveryStatus()
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

            var brevoKey = _configuration["Brevo:ApiKey"];
            var sendGridKey = _configuration["SendGrid:ApiKey"];
            bool emailLive = (!string.IsNullOrWhiteSpace(brevoKey) && !brevoKey.Contains("PASTE_YOUR")) ||
                             !string.IsNullOrWhiteSpace(sendGridKey);
            string emailProvider = !string.IsNullOrWhiteSpace(brevoKey) && !brevoKey.Contains("PASTE_YOUR")
                ? "Brevo Email API"
                : (!string.IsNullOrWhiteSpace(sendGridKey) ? "SendGrid Email API" : "LegalConnect Console Gateway");

            var waStatus = _whatsAppService.GetGatewayStatus(user.WhatsAppPhone ?? user.Phone, user.NotifyWhatsAppEnabled);

            return Ok(new NotificationDeliveryStatusDto
            {
                EmailAddress = user.Email,
                EmailVerified = user.IsEmailVerified,
                EmailProvider = emailProvider,
                EmailProviderLive = emailLive,
                WhatsAppPhone = user.WhatsAppPhone ?? user.Phone,
                WhatsAppProvider = waStatus.ActiveProvider,
                WhatsAppProviderLive = waStatus.HasMetaCredentials || waStatus.HasTwilioCredentials || waStatus.HasBrevoCredentials,
                Timezone = user.PreferredTimezone ?? "Asia/Kolkata"
            });
        }

        // ==================== HELPERS ====================

        private async Task<User?> FindUserAsync(string identifier)
        {
            if (int.TryParse(identifier, out int id))
            {
                var byId = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
                if (byId != null) return byId;
            }

            return await _context.Users.FirstOrDefaultAsync(u =>
                u.PublicId == identifier || u.Email == identifier);
        }

        private static bool IsCurrentTimeInWindow(string startTime, string endTime, string timezoneId)
        {
            try
            {
                TimeZoneInfo tz;
                try
                {
                    tz = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
                }
                catch
                {
                    tz = TimeZoneInfo.Utc;
                }

                var localTime = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).TimeOfDay;

                if (!TimeSpan.TryParse(startTime, out var start) || !TimeSpan.TryParse(endTime, out var end))
                {
                    return false;
                }

                if (start <= end)
                {
                    return localTime >= start && localTime <= end;
                }
                else
                {
                    // Overnight window e.g. 22:00 to 07:30
                    return localTime >= start || localTime <= end;
                }
            }
            catch
            {
                return false;
            }
        }

        private static string MaskEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return "Not configured";
            var parts = email.Split('@');
            var name = parts[0];
            var domain = parts[1];
            var visible = name.Length <= 2 ? name : $"{name[0]}***{name[^1]}";
            return $"{visible}@{domain}";
        }

        private static string MaskPhone(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone) || phone.Length < 4) return "Not configured";
            return $"{phone[..3]}****{phone[^2..]}";
        }
    }
}