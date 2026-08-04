using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    public interface IEmailService
    {
        Task SendVerificationEmailAsync(string email, string token);
        Task SendPasswordResetEmailAsync(string email, string token);
        Task SendContactNotificationAsync(string name, string email, string subject, string message);
    }

    public class EmailService : IEmailService
    {
        private readonly ILogger<EmailService> _logger;
        private readonly IConfiguration _configuration;
        private static readonly HttpClient _httpClient = new HttpClient();

        public EmailService(ILogger<EmailService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;
        }

        private async Task SendEmailAsync(string toEmail, string subject, string plainTextContent, string htmlContent)
        {
            var brevoKey = _configuration["Brevo:ApiKey"];
            var brevoEmail = _configuration["Brevo:SenderEmail"] ?? "jkaka0481@gmail.com";
            var brevoName = _configuration["Brevo:SenderName"] ?? "LegalConnect Admin Telemetry";

            // 1. Try Brevo API first if configured
            if (!string.IsNullOrWhiteSpace(brevoKey) && !brevoKey.Contains("PASTE_YOUR"))
            {
                try
                {
                    var brevoPayload = new
                    {
                        sender = new { name = brevoName, email = brevoEmail },
                        to = new[] { new { email = toEmail } },
                        subject = subject,
                        htmlContent = htmlContent,
                        textContent = plainTextContent
                    };

                    var req = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
                    req.Headers.Add("api-key", brevoKey);
                    req.Content = new StringContent(JsonSerializer.Serialize(brevoPayload), Encoding.UTF8, "application/json");

                    var res = await _httpClient.SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        _logger.LogInformation("✅ Brevo email successfully sent to {To}", toEmail);
                        return;
                    }

                    var err = await res.Content.ReadAsStringAsync();
                    _logger.LogWarning("⚠️ Brevo HTTP {Status}: {Error}", res.StatusCode, err);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Brevo email dispatch failed.");
                }
            }

            // 2. Try SendGrid if configured
            var sendGridKey = _configuration["SendGrid:ApiKey"];
            var sendGridFrom = _configuration["SendGrid:FromEmail"] ?? "noreply@legalconnect.com";
            var sendGridName = _configuration["SendGrid:FromName"] ?? "LegalConnect Support";

            if (!string.IsNullOrWhiteSpace(sendGridKey))
            {
                try
                {
                    var requestPayload = new
                    {
                        personalizations = new[] { new { to = new[] { new { email = toEmail } } } },
                        from = new { email = sendGridFrom, name = sendGridName },
                        subject = subject,
                        content = new[]
                        {
                            new { type = "text/plain", value = plainTextContent },
                            new { type = "text/html", value = htmlContent }
                        }
                    };

                    var request = new HttpRequestMessage(HttpMethod.Post, "https://api.sendgrid.com/v3/mail/send");
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sendGridKey);
                    request.Content = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json");

                    var response = await _httpClient.SendAsync(request);
                    if (response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation("✅ SendGrid email successfully sent to {To}", toEmail);
                        return;
                    }

                    var errBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("⚠️ SendGrid HTTP {Status}: {Error}", response.StatusCode, errBody);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ SendGrid email dispatch failed.");
                }
            }

            // 3. Fallback to console logging
            _logger.LogInformation("[EmailService Console Fallback]\nTO: {To}\nSUBJECT: {Subject}\nBODY:\n{Body}", toEmail, subject, plainTextContent);
        }

        public async Task SendVerificationEmailAsync(string email, string token)
        {
            var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
            var verificationUrl = $"{appUrl}/verify-email?token={token}&email={email}";
            var subject = "Verify Your LegalConnect Account";
            var body = $"Welcome to LegalConnect! Please verify your account by clicking the link below:\n{verificationUrl}";
            var html = $"<h2>Welcome to LegalConnect</h2><p>Please verify your account by clicking the link below:</p><p><a href='{verificationUrl}'>Verify Account</a></p>";

            await SendEmailAsync(email, subject, body, html);
        }

        public async Task SendPasswordResetEmailAsync(string email, string token)
        {
            var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
            var resetUrl = $"{appUrl}/reset-password?token={token}&email={email}";
            var subject = "Reset Your LegalConnect Password";
            var body = $"You requested a password reset. Please click the link below to set a new password:\n{resetUrl}\n\nIf you did not request this, you can ignore this message.";
            var html = $"<h2>Reset Password</h2><p>Click the link below to set a new password:</p><p><a href='{resetUrl}'>Reset Password</a></p>";

            await SendEmailAsync(email, subject, body, html);
        }

        public async Task SendContactNotificationAsync(string name, string email, string subject, string message)
        {
            var adminEmail = _configuration["SendGrid:AdminEmail"] ?? "support@legalconnect.com";
            var mailSubject = $"[Contact Form] {subject} - From {name}";
            var body = $"New Contact Submission received on LegalConnect:\n\nFrom: {name} ({email})\nSubject: {subject}\n\nMessage:\n{message}";
            var html = $"<h3>New Contact Form Submission</h3><p><strong>From:</strong> {name} ({email})</p><p><strong>Subject:</strong> {subject}</p><p><strong>Message:</strong></p><blockquote>{message}</blockquote>";

            await SendEmailAsync(adminEmail, mailSubject, body, html);
        }
    }
}