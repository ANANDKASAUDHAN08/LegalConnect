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
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> Register([FromBody] RegisterDto request)
        {
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : null;

            var result = await _authService.RegisterAndLoginAsync(request, ip, userAgent);
            if (!result.isSuccess)
            {
                return BadRequest(new { message = result.message });
            }

            var user = result.user;
            if (user != null && result.sessionId != null)
            {
                var token = _tokenService.CreateAccessToken(user, result.sessionId);
                var rawRefresh = result.rawRefreshToken!;

                _tokenService.SetAuthCookies(Response, token, rawRefresh);

                return Ok(new
                {
                    token,
                    refreshToken = rawRefresh,
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

            return Ok(new { message = result.message });
        }

        [HttpPost("login")]
        [EnableRateLimiting("AuthPolicy")]
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
                return Unauthorized(new { message = result.message });
            }

            var token = _tokenService.CreateAccessToken(result.user!, result.sessionId!);
            var rawRefresh = result.rawRefreshToken!;

            _tokenService.SetAuthCookies(Response, token, rawRefresh);

            var user = result.user!;
            return Ok(new
            {
                token,
                refreshToken = rawRefresh,
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
        [EnableRateLimiting("AuthPolicy")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto request)
        {
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : null;

            var result = await _authService.GoogleLoginAsync(request, ip, userAgent);
            if (!result.isSuccess)
            {
                return BadRequest(new { message = result.message });
            }

            var token = _tokenService.CreateAccessToken(result.user!, result.sessionId!);
            var rawRefresh = result.rawRefreshToken!;

            _tokenService.SetAuthCookies(Response, token, rawRefresh);

            var user = result.user!;
            return Ok(new
            {
                token,
                refreshToken = rawRefresh,
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

        [AllowAnonymous]
        [HttpPost("logout")]
        [EnableRateLimiting("AuthSessionPolicy")]
        public async Task<IActionResult> Logout()
        {
            // Allow logout even when access token is expired/missing.
            // This prevents ghost sessions where cookies persist but the frontend already cleared state.
            var sessionIdClaim = User?.FindFirst("SessionId")?.Value;
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();

            if (!string.IsNullOrEmpty(sessionIdClaim) || !string.IsNullOrEmpty(userIdClaim))
            {
                await _authService.LogoutAsync(sessionIdClaim, userIdClaim, ip);
            }
            _tokenService.ClearAuthCookies(Response);

            return Ok(new { message = "Logged out successfully." });
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        [EnableRateLimiting("AuthSessionPolicy")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshRequestDto? bodyPayload = null)
        {
            // Prioritize explicitly provided refresh token in JSON request body over cookie
            var rawRefreshToken = bodyPayload?.RefreshToken;
            if (string.IsNullOrWhiteSpace(rawRefreshToken))
            {
                rawRefreshToken = Request.Cookies["__session"];
            }

            var ip = Request.HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.ContainsKey("User-Agent") ? Request.Headers["User-Agent"].ToString() : null;

            var result = await _authService.RefreshTokenAsync(rawRefreshToken ?? "", ip, userAgent);
            if (!result.isSuccess)
            {
                return Unauthorized(new { message = result.message });
            }

            _tokenService.SetAuthCookies(Response, result.accessToken!, result.newRawRefreshToken!);

            return Ok(new { token = result.accessToken, refreshToken = result.newRawRefreshToken, message = result.message });
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
                return BadRequest(new { message = result.message });
            }
            return Ok(new { message = result.message });
        }
    }
}