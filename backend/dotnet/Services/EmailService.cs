using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    public interface IEmailService
    {
        Task SendVerificationEmailAsync(string email, string token);
        Task SendPasswordResetEmailAsync(string email, string token);
    }

    public class EmailService : IEmailService
    {
        private readonly ILogger<EmailService> _logger;
        private readonly IConfiguration _configuration;

        public EmailService(ILogger<EmailService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;
        }

        public Task SendVerificationEmailAsync(string email, string token)
        {
            var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
            var verificationUrl = $"{appUrl}/verify-email?token={token}&email={email}";

            _logger.LogInformation("==================================================");
            _logger.LogInformation($"TO: {email}");
            _logger.LogInformation("SUBJECT: Verify Your LegalConnect Account");
            _logger.LogInformation($"BODY: Welcome to LegalConnect! Please verify your account by clicking the link below:\n{verificationUrl}");
            _logger.LogInformation("==================================================");

            return Task.CompletedTask;
        }

        public Task SendPasswordResetEmailAsync(string email, string token)
        {
            var appUrl = _configuration["AppUrl"] ?? "http://localhost:4200";
            var resetUrl = $"{appUrl}/reset-password?token={token}&email={email}";

            _logger.LogInformation("==================================================");
            _logger.LogInformation($"TO: {email}");
            _logger.LogInformation("SUBJECT: Reset Your LegalConnect Password");
            _logger.LogInformation($"BODY: You requested a password reset. Please click the link below to set a new password:\n{resetUrl}\n\nIf you did not request this, you can ignore this email.");
            _logger.LogInformation("==================================================");

            return Task.CompletedTask;
        }
    }
}
