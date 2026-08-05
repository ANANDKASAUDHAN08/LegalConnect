using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoreApi.Services
{
    public class VerificationService : IVerificationService
    {
        private readonly AppDbContext _context;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<VerificationService> _logger;
        private static readonly HttpClient _httpClient = new HttpClient();

        public VerificationService(
            AppDbContext context,
            IEmailService emailService,
            IConfiguration configuration,
            ILogger<VerificationService> logger)
        {
            _context = context;
            _emailService = emailService;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<VerificationResponseDto> VerifyEmailTokenAsync(string email, string token)
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token))
            {
                return new VerificationResponseDto
                {
                    IsSuccess = false,
                    Message = "Invalid parameters provided for email verification."
                };
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && u.EmailVerificationToken == token);
            if (user == null)
            {
                return new VerificationResponseDto
                {
                    IsSuccess = false,
                    Message = "Invalid or expired email verification link."
                };
            }

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;
            await _context.SaveChangesAsync();

            _logger.LogInformation("✅ Email verified successfully for UserId: {UserId}, Email: {Email}", user.Id, user.Email);

            return new VerificationResponseDto
            {
                IsSuccess = true,
                Message = "Email verified successfully! You can now sign in.",
                VerifiedField = "Email",
                VerifiedValue = user.Email,
                VerifiedAt = DateTime.UtcNow
            };
        }

        public async Task<VerificationResponseDto> ResendEmailVerificationAsync(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return new VerificationResponseDto
                {
                    IsSuccess = false,
                    Message = "Email address is required."
                };
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
            {
                // Return success message to prevent user enumeration
                return new VerificationResponseDto
                {
                    IsSuccess = true,
                    Message = "If an unverified account exists with this email, a verification link has been sent."
                };
            }

            if (user.IsEmailVerified)
            {
                return new VerificationResponseDto
                {
                    IsSuccess = true,
                    Message = "Email is already verified."
                };
            }

            var newToken = Guid.NewGuid().ToString("N");
            user.EmailVerificationToken = newToken;
            await _context.SaveChangesAsync();

            await _emailService.SendVerificationEmailAsync(user.Email, newToken);

            _logger.LogInformation("📧 Resent email verification link to UserId: {UserId}, Email: {Email}", user.Id, user.Email);

            return new VerificationResponseDto
            {
                IsSuccess = true,
                Message = "Verification link sent! Please check your inbox.",
                VerifiedField = "Email",
                VerifiedValue = user.Email
            };
        }

        public async Task<VerificationResponseDto> VerifyPhoneAsync(int userId, VerifyPhoneDto request)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return new VerificationResponseDto
                {
                    IsSuccess = false,
                    Message = "User not found."
                };
            }

            if (!string.IsNullOrWhiteSpace(request?.FirebaseToken))
            {
                try
                {
                    var firebaseApiKey = _configuration["Firebase:ApiKey"] 
                                       ?? _configuration["firebase:apiKey"] 
                                       ?? "";
                    var verifyUrl = $"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={firebaseApiKey}";

                    var verifyResponse = await _httpClient.PostAsJsonAsync(verifyUrl, new { idToken = request.FirebaseToken });

                    if (!verifyResponse.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("⚠️ Firebase token verification failed for UserId: {UserId}", userId);
                        return new VerificationResponseDto
                        {
                            IsSuccess = false,
                            Message = "Phone verification failed. Invalid or expired verification token."
                        };
                    }

                    var verifyResult = await verifyResponse.Content.ReadFromJsonAsync<FirebaseLookupResponse>();
                    var firebasePhone = verifyResult?.Users?.FirstOrDefault()?.PhoneNumber;

                    if (!string.IsNullOrWhiteSpace(firebasePhone))
                    {
                        user.Phone = firebasePhone;
                    }
                    else if (!string.IsNullOrWhiteSpace(request?.Phone))
                    {
                        user.Phone = request.Phone.Trim();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error verifying Firebase token for UserId: {UserId}", userId);
                    return new VerificationResponseDto
                    {
                        IsSuccess = false,
                        Message = "Phone verification failed. Please try again."
                    };
                }
            }
            else
            {
                _logger.LogWarning("⚠️ Phone verification attempted without Firebase token for UserId: {UserId}", userId);
                return new VerificationResponseDto
                {
                    IsSuccess = false,
                    Message = "Phone verification requires a valid Firebase verification token."
                };
            }

            user.IsPhoneVerified = true;
            await _context.SaveChangesAsync();

            _logger.LogInformation("✅ Phone number verified for UserId: {UserId}, Phone: {Phone}", user.Id, user.Phone);

            return new VerificationResponseDto
            {
                IsSuccess = true,
                Message = "Phone number verified successfully!",
                VerifiedField = "Phone",
                VerifiedValue = user.Phone,
                VerifiedAt = DateTime.UtcNow
            };
        }

        public async Task MarkEmailVerifiedAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user != null && !user.IsEmailVerified)
            {
                user.IsEmailVerified = true;
                user.EmailVerificationToken = null;
                await _context.SaveChangesAsync();
                _logger.LogInformation("✅ Email automatically verified via OAuth for UserId: {UserId}", userId);
            }
        }
    }
}