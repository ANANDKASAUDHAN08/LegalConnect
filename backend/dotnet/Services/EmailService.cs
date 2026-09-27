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
        Task SendOtpEmailAsync(string email, string code, string userName);
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
                        _logger.LogInformation("[Brevo Email] Successfully sent to {To}", toEmail);
                        return;
                    }

                    var err = await res.Content.ReadAsStringAsync();
                    _logger.LogWarning("[Brevo Email] HTTP {Status}: {Error}", res.StatusCode, err);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[Brevo Email] Dispatch failed.");
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
                        _logger.LogInformation("[SendGrid Email] Successfully sent to {To}", toEmail);
                        return;
                    }

                    var errBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("[SendGrid Email] HTTP {Status}: {Error}", response.StatusCode, errBody);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[SendGrid Email] Dispatch failed.");
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
            var body = $"Welcome to LegalConnect!\n\nPlease verify your email address by clicking the link below:\n{verificationUrl}\n\nIf you did not sign up for LegalConnect, you can safely ignore this email.\n\nLegalConnect Security Team";
            var html = $@"
                <div style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);'>
                    <div style='display: flex; align-items: center; margin-bottom: 20px;'>
                        <div style='width: 38px; height: 38px; border-radius: 10px; background-color: #eff6ff; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px;'>
                            <span style='font-size: 20px; line-height: 1; color: #2563eb;'>&#x2714;</span>
                        </div>
                        <div>
                            <h2 style='color: #0f172a; margin: 0; font-size: 18px; font-weight: 800;'>LegalConnect Verification</h2>
                            <p style='color: #64748b; margin: 2px 0 0 0; font-size: 12px;'>Confirm your registered email address</p>
                        </div>
                    </div>
                    <p style='color: #334155; font-size: 14px; line-height: 1.5;'>Welcome to LegalConnect! To activate your citizen legal dossier and safeguard your appointments, please confirm your email address below:</p>
                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='{verificationUrl}' style='display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(37,99,235,0.25);'>
                            Verify Account
                        </a>
                    </div>
                    <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin: 20px 0;'>
                        <p style='color: #64748b; font-size: 11px; margin: 0; word-break: break-all;'>
                            If the button above does not work, copy and paste this link into your browser:<br/>
                            <a href='{verificationUrl}' style='color: #2563eb; text-decoration: underline;'>{verificationUrl}</a>
                        </p>
                    </div>
                    <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;' />
                    <div style='display: flex; align-items: center; color: #94a3b8; font-size: 11px;'>
                        <span style='font-size: 13px; margin-right: 6px; color: #94a3b8;'>&#x1F512;</span>
                        <span>LegalConnect Security &bull; Protecting Client & Advocate Communications</span>
                    </div>
                </div>";

            await SendEmailAsync(email, subject, body, html);
        }

        public async Task SendPasswordResetEmailAsync(string email, string token)
        {
            var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
            var resetUrl = $"{appUrl}/reset-password?token={token}&email={email}";
            var subject = "Reset Your LegalConnect Password";
            var body = $"You requested a password reset for LegalConnect.\n\nPlease click the link below to set a new password:\n{resetUrl}\n\nThis reset link expires in 30 minutes.\n\nIf you did not request this change, you can safely ignore this message.\n\nLegalConnect Security Team";
            var html = $@"
                <div style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);'>
                    <div style='display: flex; align-items: center; margin-bottom: 20px;'>
                        <div style='width: 38px; height: 38px; border-radius: 10px; background-color: #fffbeb; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px;'>
                            <span style='font-size: 20px; line-height: 1; color: #d97706;'>&#x1F511;</span>
                        </div>
                        <div>
                            <h2 style='color: #0f172a; margin: 0; font-size: 18px; font-weight: 800;'>Password Reset Request</h2>
                            <p style='color: #64748b; margin: 2px 0 0 0; font-size: 12px;'>Authorized account access recovery</p>
                        </div>
                    </div>
                    <p style='color: #334155; font-size: 14px; line-height: 1.5;'>We received a request to reset your LegalConnect account password. Click the button below to choose a secure new password:</p>
                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='{resetUrl}' style='display: inline-block; background-color: #d97706; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(217,119,6,0.25);'>
                            Reset Password
                        </a>
                    </div>
                    <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin: 20px 0;'>
                        <p style='color: #64748b; font-size: 11px; margin: 0;'>
                            This link expires in <strong>30 minutes</strong>. If you did not initiate this request, your account credentials remain unchanged.
                        </p>
                    </div>
                    <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;' />
                    <div style='display: flex; align-items: center; color: #94a3b8; font-size: 11px;'>
                        <span style='font-size: 13px; margin-right: 6px; color: #94a3b8;'>&#x1F512;</span>
                        <span>LegalConnect Security &bull; Automated Security Protocol</span>
                    </div>
                </div>";

            await SendEmailAsync(email, subject, body, html);
        }

        public async Task SendContactNotificationAsync(string name, string email, string subject, string message)
        {
            var adminEmail = _configuration["SendGrid:AdminEmail"] ?? "support@legalconnect.com";
            var mailSubject = $"[Contact Form] {subject} - From {name}";
            var body = $"New Contact Submission received on LegalConnect:\n\nFrom: {name} ({email})\nSubject: {subject}\n\nMessage:\n{message}";
            var html = $@"
                <div style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff;'>
                    <div style='display: flex; align-items: center; margin-bottom: 16px;'>
                        <div style='width: 36px; height: 36px; border-radius: 8px; background-color: #eef2ff; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px;'>
                            <span style='font-size: 18px; line-height: 1; color: #4f46e5;'>&#x2709;</span>
                        </div>
                        <h3 style='margin: 0; color: #0f172a; font-size: 16px;'>Contact Form Submission</h3>
                    </div>
                    <table style='width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;'>
                        <tr>
                            <td style='padding: 6px 0; color: #64748b; width: 80px;'><strong>From:</strong></td>
                            <td style='padding: 6px 0; color: #0f172a;'>{name} &lt;{email}&gt;</td>
                        </tr>
                        <tr>
                            <td style='padding: 6px 0; color: #64748b;'><strong>Subject:</strong></td>
                            <td style='padding: 6px 0; color: #0f172a;'>{subject}</td>
                        </tr>
                    </table>
                    <div style='background-color: #f8fafc; border-left: 3px solid #4f46e5; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 12px; font-size: 13px; color: #334155; line-height: 1.6;'>
                        {message}
                    </div>
                </div>";

            await SendEmailAsync(adminEmail, mailSubject, body, html);
        }

        public async Task SendOtpEmailAsync(string email, string code, string userName)
        {
            var subject = $"Your LegalConnect Verification Code: {code}";
            var body = $"Hello {userName},\n\nYour 6-digit verification security code is: {code}\n\nThis code expires in 10 minutes. For your security, do not share this code with anyone.\n\nLegalConnect Security Team";
            var html = $@"
                <div style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);'>
                    <div style='display: flex; align-items: center; margin-bottom: 20px;'>
                        <div style='width: 38px; height: 38px; border-radius: 10px; background-color: #f0fdf4; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px;'>
                            <span style='font-size: 20px; line-height: 1; color: #16a34a;'>&#x2714;</span>
                        </div>
                        <div>
                            <h2 style='color: #0f172a; margin: 0; font-size: 18px; font-weight: 800;'>LegalConnect Verification</h2>
                            <p style='color: #64748b; margin: 2px 0 0 0; font-size: 12px;'>Secure Mobile Credential Authentication</p>
                        </div>
                    </div>
                    <p style='color: #475569; font-size: 14px;'>Hello <strong>{userName}</strong>,</p>
                    <p style='color: #475569; font-size: 14px;'>Your mobile verification security code is:</p>
                    <div style='background-color: #f0fdf4; border: 1px dashed #22c55e; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;'>
                        <span style='font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #15803d; font-family: monospace;'>{code}</span>
                    </div>
                    <div style='display: flex; align-items: center; color: #64748b; font-size: 12px; margin-top: 14px;'>
                        <span style='font-size: 13px; margin-right: 6px; color: #64748b;'>&#x23F1;</span>
                        <span>This code will expire in <strong>10 minutes</strong>. If you did not request this verification, you can safely ignore this email.</span>
                    </div>
                    <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />
                    <div style='display: flex; align-items: center; color: #94a3b8; font-size: 11px;'>
                        <span style='font-size: 13px; margin-right: 6px; color: #94a3b8;'>&#x1F512;</span>
                        <span>LegalConnect Security &bull; Protecting Client & Advocate Communications</span>
                    </div>
                </div>";

            await SendEmailAsync(email, subject, body, html);
        }
    }
}