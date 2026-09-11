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

        public void SetAuthCookies(HttpResponse response, string accessToken, string refreshToken)
        {
            var isSecure = !_env.IsDevelopment();
            // Use SameSite=None in production for Firebase Hosting → Cloud Run proxy compatibility.
            // Lax blocks cookies on some mobile/PWA scenarios where the proxy hop is treated as cross-site.
            // In development (localhost), use Lax since None requires Secure which requires HTTPS.
            var sameSiteMode = isSecure ? SameSiteMode.None : SameSiteMode.Lax;
            
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
            var sameSiteMode = isSecure ? SameSiteMode.None : SameSiteMode.Lax;
            
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
    }
}