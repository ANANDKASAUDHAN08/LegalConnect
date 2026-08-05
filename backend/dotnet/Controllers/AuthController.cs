using System;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ITokenService _tokenService;
        private readonly IUserProfileService _profileService;

        public AuthController(
            IAuthService authService,
            ITokenService tokenService,
            IUserProfileService profileService)
        {
            _authService = authService;
            _tokenService = tokenService;
            _profileService = profileService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto request)
        {
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _authService.RegisterAsync(request, ip);
            if (!result.isSuccess)
            {
                return BadRequest(result.message);
            }
            return Ok(new { message = result.message });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto request)
        {
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : null;

            var result = await _authService.LoginAsync(request, ip, userAgent);
            if (!result.isSuccess)
            {
                if (result.requires2fa)
                {
                    return Ok(new { requires2fa = true, message = result.message });
                }
                return Unauthorized(result.message);
            }

            var token = _tokenService.CreateAccessToken(result.user!, result.sessionId!);
            var (rawRefresh, _) = _tokenService.GenerateRefreshToken(result.user!.Id, result.sessionId!);

            _tokenService.SetAuthCookies(Response, token, rawRefresh);

            var user = result.user!;
            return Ok(new
            {
                token,
                message = result.message,
                user = new
                {
                    id = user.Id,
                    fullName = user.FullName,
                    email = user.Email,
                    role = user.Role,
                    createdAt = user.CreatedAt,
                    phone = user.Phone,
                    isPhoneVerified = user.IsPhoneVerified,
                    isEmailVerified = user.IsEmailVerified,
                    isTwoFactorEnabled = user.IsTwoFactorEnabled,
                    clientLanguage = user.ClientLanguage,
                    clientCity = user.ClientCity,
                    clientInterest = user.ClientInterest,
                    avatarUrl = user.AvatarUrl,
                    identityStatus = user.IdentityStatus
                }
            });
        }

        [HttpPost("google")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto request)
        {
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : null;

            var result = await _authService.GoogleLoginAsync(request, ip, userAgent);
            if (!result.isSuccess)
            {
                return BadRequest(result.message);
            }

            var token = _tokenService.CreateAccessToken(result.user!, result.sessionId!);
            var (rawRefresh, _) = _tokenService.GenerateRefreshToken(result.user!.Id, result.sessionId!);

            _tokenService.SetAuthCookies(Response, token, rawRefresh);

            var user = result.user!;
            return Ok(new
            {
                token,
                message = result.message,
                user = new
                {
                    id = user.Id,
                    fullName = user.FullName,
                    email = user.Email,
                    role = user.Role,
                    createdAt = user.CreatedAt,
                    phone = user.Phone,
                    isPhoneVerified = user.IsPhoneVerified,
                    isEmailVerified = user.IsEmailVerified,
                    isTwoFactorEnabled = user.IsTwoFactorEnabled,
                    clientLanguage = user.ClientLanguage,
                    clientCity = user.ClientCity,
                    clientInterest = user.ClientInterest,
                    avatarUrl = user.AvatarUrl,
                    identityStatus = user.IdentityStatus
                }
            });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var sessionIdClaim = User.FindFirst("SessionId")?.Value;
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();

            await _authService.LogoutAsync(sessionIdClaim, userIdClaim, ip);
            _tokenService.ClearAuthCookies(Response);

            return Ok(new { message = "Logged out successfully." });
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<IActionResult> RefreshToken()
        {
            var rawRefreshToken = Request.Cookies["__session"];
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : null;

            var result = await _authService.RefreshTokenAsync(rawRefreshToken ?? "", ip, userAgent);
            if (!result.isSuccess)
            {
                return Unauthorized(new { message = result.message });
            }

            _tokenService.SetAuthCookies(Response, result.accessToken!, result.newRawRefreshToken!);

            return Ok(new { token = result.accessToken, message = result.message });
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto request)
        {
            await _authService.ForgotPasswordAsync(request);
            return Ok(new { message = "If the email exists, a password reset link has been sent." });
        }

        [HttpPost("reset-password")]
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
        {
            var result = await _authService.ResetPasswordAsync(request);
            if (!result.isSuccess)
            {
                return BadRequest(result.message);
            }
            return Ok(new { message = result.message });
        }
    }
}