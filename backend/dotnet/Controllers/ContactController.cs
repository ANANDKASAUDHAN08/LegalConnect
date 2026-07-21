using System;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
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
    }

    public class SubmitContactDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}