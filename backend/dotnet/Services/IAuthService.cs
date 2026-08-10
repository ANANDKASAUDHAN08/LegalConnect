using System.Threading.Tasks;
using CoreApi.Models;

namespace CoreApi.Services
{
    public interface IAuthService
    {
        Task<(bool isSuccess, string message, User? user)> RegisterAsync(RegisterDto request, string? ipAddress);
        Task<(bool isSuccess, string message, User? user, string? sessionId, string? rawRefreshToken)> RegisterAndLoginAsync(RegisterDto request, string? ipAddress, string? userAgent);
        Task<(bool isSuccess, string message, bool requires2fa, User? user, string? sessionId, string? rawRefreshToken)> LoginAsync(LoginDto request, string? ipAddress, string? userAgent);
        Task<(bool isSuccess, string message, User? user, string? sessionId, string? rawRefreshToken)> GoogleLoginAsync(GoogleLoginDto request, string? ipAddress, string? userAgent);
        Task<(bool isSuccess, string message, string? accessToken, string? newRawRefreshToken)> RefreshTokenAsync(string rawRefreshToken, string? ipAddress, string? userAgent);
        Task LogoutAsync(string? sessionIdClaim, string? userIdClaim, string? ipAddress);
        Task<bool> ForgotPasswordAsync(ForgotPasswordDto request);
        Task<(bool isSuccess, string message)> ResetPasswordAsync(ResetPasswordDto request);
    }
}