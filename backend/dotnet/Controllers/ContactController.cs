using System;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using CoreApi.Models.Admin;
using CoreApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ContactController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEmailService _emailService;

        public ContactController(AppDbContext context, IEmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        [HttpPost]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> SubmitContact([FromBody] SubmitContactDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

            var submission = new ContactSubmission
            {
                FullName = request.FullName.Trim(),
                Email = request.Email.Trim().ToLowerInvariant(),
                Subject = request.Subject.Trim(),
                Message = request.Message.Trim(),
                Status = "New",
                CreatedAt = DateTime.UtcNow,
                IpAddress = ip
            };

            _context.ContactSubmissions.Add(submission);
            await _context.SaveChangesAsync();

            // Auto-create AdminNotification for the new grievance ticket
            _context.AdminNotifications.Add(new AdminNotification
            {
                TargetRole = "SupportDesk",
                Type = "urgent_ticket",
                Severity = "warning",
                Category = "support",
                Title = $"Grievance Ticket #{submission.Id}: {submission.Subject}",
                Message = $"Submitted by {submission.FullName}: {submission.Message}",
                CreatedAt = submission.CreatedAt,
                ActionUrl = "/support",
                ActionLabel = "Open Grievance Desk",
                Source = "Support Desk",
                RelatedEntityType = "ContactSubmission",
                RelatedEntityId = submission.Id
            });
            await _context.SaveChangesAsync();

            // Dispatch notification email via EmailService (using SendGrid or Logger fallback)
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendContactNotificationAsync(
                        submission.FullName,
                        submission.Email,
                        submission.Subject,
                        submission.Message
                    );
                }
                catch
                {
                    // Fail silently in background thread
                }
            });

            return Ok(new
            {
                message = "Thank you for reaching out! Your message has been received.",
                ticketId = $"LC-TKT-{submission.Id:D5}",
                submittedAt = submission.CreatedAt
            });
        }

        [HttpPost("subscribe-newsletter")]
        public IActionResult SubscribeNewsletter([FromBody] SubscribeNewsletterDto request)
        {
            if (string.IsNullOrWhiteSpace(request?.Email))
            {
                return BadRequest(new { message = "Valid email address is required." });
            }

            var email = request.Email.Trim().ToLowerInvariant();

            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendContactNotificationAsync(
                        "Newsletter Subscriber",
                        email,
                        "Newsletter Subscription Confirmation",
                        $"Thank you for subscribing to LegalConnect updates with email: {email}"
                    );
                }
                catch
                {
                    // Fail silently in background thread
                }
            });

            return Ok(new { message = "Successfully subscribed to LegalConnect updates!" });
        }
    }

    public class SubscribeNewsletterDto
    {
        public string Email { get; set; } = string.Empty;
    }

    public class SubmitContactDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}