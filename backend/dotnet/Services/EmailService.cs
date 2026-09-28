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
        Task SendVerificationEmailAsync(string email, string token, string? otpCode = null);
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

        public async Task SendVerificationEmailAsync(string email, string token, string? otpCode = null)
        {
            var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
            var verificationUrl = $"{appUrl}/verify-email?token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(email)}";

            // Extract OTP code if not passed explicitly and token has the format "{otp}:{secret}"
            if (string.IsNullOrWhiteSpace(otpCode) && token.Contains(':'))
            {
                var parts = token.Split(':', 2);
                if (parts[0].Length == 6 && parts[0].All(char.IsDigit))
                {
                    otpCode = parts[0];
                }
            }

            var subject = "Verify Your LegalConnect Account";
            var body = !string.IsNullOrWhiteSpace(otpCode)
                ? $"Welcome to LegalConnect!\n\nYour 6-Digit Email Verification Code: {otpCode}\n\nAlternatively, verify your account in one click by opening this link:\n{verificationUrl}\n\nThis verification code and link are valid for 24 hours.\nIf you did not sign up for LegalConnect, you can safely ignore this email.\n\nLegalConnect Security Team"
                : $"Welcome to LegalConnect!\n\nPlease verify your email address by clicking the link below:\n{verificationUrl}\n\nThis verification link is valid for 24 hours.\nIf you did not sign up for LegalConnect, you can safely ignore this email.\n\nLegalConnect Security Team";

            var otpBlockHtml = !string.IsNullOrWhiteSpace(otpCode) ? $@"
                    <div style='background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px dashed #cbd5e1; border-radius: 14px; padding: 22px 20px; text-align: center; margin: 24px 0;'>
                        <div style='font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; margin-bottom: 8px;'>Your 6-Digit Verification Code</div>
                        <div style='font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 36px; font-weight: 800; letter-spacing: 0.28em; color: #0f172a; padding-left: 0.28em;'>{otpCode}</div>
                        <div style='font-size: 12px; color: #64748b; margin-top: 8px;'>Enter this code on the verification screen or click the button below</div>
                    </div>" : "";

            var html = $@"
                <div style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.04);'>
                    <div style='display: flex; align-items: center; margin-bottom: 22px;'>
                        <div style='width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); display: inline-flex; align-items: center; justify-content: center; margin-right: 14px; border: 1px solid #bfdbfe; font-size: 20px; font-weight: bold; color: #2563eb; line-height: 42px; text-align: center;'>
                            &#x2713;
                        </div>
                        <div>
                            <h2 style='color: #0f172a; margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.02em;'>LegalConnect Security</h2>
                            <p style='color: #64748b; margin: 3px 0 0 0; font-size: 13px;'>Confirm your registered email address</p>
                        </div>
                    </div>
                    <p style='color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;'>Welcome to LegalConnect! To activate your citizen legal dossier, protect attorney-client confidentiality, and receive court hearing alerts, please confirm your email address below:</p>
                    {otpBlockHtml}
                    <div style='text-align: center; margin: 26px 0;'>
                        <a href='{verificationUrl}' style='display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(37,99,235,0.3);'>
                            Verify Account Automatically
                        </a>
                    </div>
                    <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 22px 0;'>
                        <p style='color: #64748b; font-size: 11px; margin: 0; line-height: 1.5; word-break: break-all;'>
                            If the button above does not work, copy and paste this link into your browser:<br/>
                            <a href='{verificationUrl}' style='color: #2563eb; text-decoration: underline;'>{verificationUrl}</a>
                        </p>
                    </div>
                    <p style='color: #94a3b8; font-size: 11px; margin: 0 0 20px 0;'>This verification link and code are valid for <strong>24 hours</strong>. If you did not create an account, no action is needed.</p>
                    <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 20px 0 16px;' />
                    <div style='display: flex; align-items: center; color: #94a3b8; font-size: 11px;'>
                        <span style='font-size: 13px; margin-right: 6px;'>&#x1F6E1;</span>
                        <span>LegalConnect Security &bull; Protecting Client & Advocate Communications</span>
                    </div>
                </div>";

            await SendEmailAsync(email, subject, body, html);
        }

        public async Task SendPasswordResetEmailAsync(string email, string token)
        {
            var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
            var resetUrl = $"{appUrl}/reset-password?token={token}&email={Uri.EscapeDataString(email)}";
            var subject = "Reset Your LegalConnect Password";
            var body = $"You requested a password reset for LegalConnect.\n\nPlease click the link below to set a new password:\n{resetUrl}\n\nThis reset link expires in 30 minutes.\n\nIf you did not request this change, you can safely ignore this message.\n\nLegalConnect Security Team";
            var html = $@"
                <div style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.04);'>
                    <div style='display: flex; align-items: center; margin-bottom: 22px;'>
                        <div style='width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); display: inline-flex; align-items: center; justify-content: center; margin-right: 14px; border: 1px solid #fde68a; font-size: 20px; color: #d97706; line-height: 42px; text-align: center;'>
                            &#x1F511;
                        </div>
                        <div>
                            <h2 style='color: #0f172a; margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.02em;'>Password Reset Request</h2>
                            <p style='color: #64748b; margin: 3px 0 0 0; font-size: 13px;'>Authorized account access recovery</p>
                        </div>
                    </div>
                    <p style='color: #334155; font-size: 14px; line-height: 1.6;'>We received a request to reset your LegalConnect account password. Click the button below to choose a secure new password:</p>
                    <div style='text-align: center; margin: 28px 0;'>
                        <a href='{resetUrl}' style='display: inline-block; background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(217,119,6,0.3);'>
                            Reset Password
                        </a>
                    </div>
                    <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 22px 0;'>
                        <p style='color: #64748b; font-size: 11px; margin: 0;'>
                            This link expires in <strong>30 minutes</strong>. If you did not initiate this request, your account credentials remain unchanged.
                        </p>
                    </div>
                    <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 20px 0 16px;' />
                    <div style='display: flex; align-items: center; color: #94a3b8; font-size: 11px;'>
                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#94a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align: middle; margin-right: 6px;'>
                            <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'></path>
                        </svg>
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
                        <div style='width: 36px; height: 36px; border-radius: 8px; background-color: #eef2ff; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 18px; color: #4f46e5; line-height: 36px; text-align: center;'>
                            &#x2709;
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
                <div style='font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.04);'>
                    <div style='display: flex; align-items: center; margin-bottom: 22px;'>
                        <div style='width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); display: inline-flex; align-items: center; justify-content: center; margin-right: 14px; border: 1px solid #bbf7d0; font-size: 20px; color: #16a34a; line-height: 42px; text-align: center;'>
                            &#x2713;
                        </div>
                        <div>
                            <h2 style='color: #0f172a; margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.02em;'>LegalConnect Security</h2>
                            <p style='color: #64748b; margin: 3px 0 0 0; font-size: 13px;'>Secure Verification Code</p>
                        </div>
                    </div>
                    <p style='color: #475569; font-size: 14px; margin: 0 0 10px 0;'>Hello <strong>{userName}</strong>,</p>
                    <p style='color: #475569; font-size: 14px; margin: 0 0 20px 0;'>Your one-time verification security code is:</p>
                    <div style='background-color: #f0fdf4; border: 1px dashed #22c55e; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;'>
                        <span style='font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #15803d; font-family: monospace;'>{code}</span>
                    </div>
                    <div style='display: flex; align-items: center; color: #64748b; font-size: 12px; margin-top: 14px;'>
                        <span style='font-size: 13px; margin-right: 6px;'>&#x23F1;</span>
                        <span>This code will expire in <strong>10 minutes</strong>. If you did not request this verification, you can safely ignore this email.</span>
                    </div>
                    <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;' />
                    <div style='display: flex; align-items: center; color: #94a3b8; font-size: 11px;'>
                        <span style='font-size: 13px; margin-right: 6px;'>&#x1F6E1;</span>
                        <span>LegalConnect Security &bull; Protecting Client & Advocate Communications</span>
                    </div>
                </div>";

            await SendEmailAsync(email, subject, body, html);
        }
    }
}