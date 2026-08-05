using System.Threading.Tasks;
using CoreApi.Models;

namespace CoreApi.Services
{
    public interface IVerificationService
    {
        Task<VerificationResponseDto> VerifyEmailTokenAsync(string email, string token);
        Task<VerificationResponseDto> ResendEmailVerificationAsync(string email);
        Task<VerificationResponseDto> VerifyPhoneAsync(int userId, VerifyPhoneDto request);
        Task MarkEmailVerifiedAsync(int userId);
    }
}