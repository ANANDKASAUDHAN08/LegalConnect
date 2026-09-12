using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CoreApi.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace CoreApi.Services
{
    public class TokenService : ITokenService
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;

        public TokenService(IConfiguration configuration, IWebHostEnvironment env)
        {
            _configuration = configuration;
            _env = env;
        }

        public string CreateAccessToken(User user, string sessionId)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim("SessionId", sessionId)
            };

            var creds = CoreApi.Extensions.AuthenticationExtensions.GetSigningCredentials(_configuration);

            var issuer = _configuration["Jwt:Issuer"] ?? _configuration["Jwt__Issuer"] ?? "LegalConnect-API";
            var audience = _configuration["Jwt:Audience"] ?? _configuration["Jwt__Audience"] ?? "LegalConnect-Admin";

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(15),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public (string rawToken, RefreshToken entity) GenerateRefreshToken(int userId, string sessionId)
        {
            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            var hashedToken = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

            var entity = new RefreshToken
            {
                Token = hashedToken,
                UserId = userId,
                SessionId = sessionId,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(30)
            };

            return (rawToken, entity);
        }

        /// <summary>
        /// M-02: Detects user agents that are broken by SameSite=None according to Microsoft/Chromium guidance:
        /// - iOS 12 Safari / WKWebView / Chrome
        /// - macOS 10.14 Mojave Safari
        /// - Chrome 51 to 66
        /// For these clients, SameSiteMode.Unspecified is used (omits SameSite attribute) to prevent browsers
        /// from treating the cookie as Strict and breaking authentication.
        /// </summary>
        public static bool DisallowsSameSiteNone(string? userAgent)
        {
            if (string.IsNullOrWhiteSpace(userAgent))
                return false;

            // iOS 12 Safari / WebView / Chrome (broken by SameSite=None)
            if (userAgent.Contains("CPU iPhone OS 12") || userAgent.Contains("iPad; CPU OS 12"))
                return true;

            // macOS 10.14 Mojave Safari (broken by SameSite=None)
            if (userAgent.Contains("Macintosh; Intel Mac OS X 10_14") &&
                userAgent.Contains("Version/") && userAgent.Contains("Safari"))
                return true;

            // Chrome 51 to 66
            if (userAgent.Contains("Chrome/5") || userAgent.Contains("Chrome/6"))
                return true;

            return false;
        }

        private SameSiteMode GetSameSiteMode(HttpResponse response)
        {
            if (_env.IsDevelopment())
            {
                return SameSiteMode.Lax;
            }

            var userAgent = response.HttpContext?.Request?.Headers["User-Agent"].ToString();
            if (DisallowsSameSiteNone(userAgent))
            {
                return SameSiteMode.Unspecified;
            }

            return SameSiteMode.None;
        }

        public void SetAuthCookies(HttpResponse response, string accessToken, string refreshToken)
        {
            var isSecure = !_env.IsDevelopment();
            var sameSiteMode = GetSameSiteMode(response);
            
            var tokenCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Expires = DateTime.UtcNow.AddMinutes(15),
                Path = "/"
            };
            response.Cookies.Append("lc_token", accessToken, tokenCookieOptions);

            var refreshCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Expires = DateTime.UtcNow.AddDays(30),
                Path = "/"
            };
            response.Cookies.Append("__session", refreshToken, refreshCookieOptions);
        }

        public void ClearAuthCookies(HttpResponse response)
        {
            var isSecure = !_env.IsDevelopment();
            var sameSiteMode = GetSameSiteMode(response);
            
            response.Cookies.Delete("lc_token", new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Path = "/"
            });

            response.Cookies.Delete("__session", new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Path = "/"
            });
        }

        public void SetAdminCookie(HttpResponse response, string token)
        {
            var isSecure = response.HttpContext?.Request?.IsHttps == true || !_env.IsDevelopment();
            var sameSiteMode = GetSameSiteMode(response);

            response.Cookies.Append("lc_admin_token", token, new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Expires = DateTime.UtcNow.AddHours(4),
                Path = "/"
            });
        }

        public void ClearAdminCookie(HttpResponse response)
        {
            var isSecure = response.HttpContext?.Request?.IsHttps == true || !_env.IsDevelopment();
            var sameSiteMode = GetSameSiteMode(response);

            response.Cookies.Delete("lc_admin_token", new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Path = "/"
            });
        }
    }
}