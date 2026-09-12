using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CoreApi.Data;
using CoreApi.DTOs.Admin;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

using Microsoft.AspNetCore.SignalR;
using CoreApi.Hubs.Admin;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public partial class AdminController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;
        private readonly ILawyerSyncService _syncService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<AdminController> _logger;
        private readonly IMemoryCache _cache;
        private readonly IPiiSanitizerService _piiSanitizer;
        private readonly IHubContext<AdminNotificationHub>? _hubContext;

        public AdminController(
            AppDbContext context,
            IConfiguration configuration,
            IWebHostEnvironment env,
            ILawyerSyncService syncService,
            IHttpClientFactory httpClientFactory,
            ILogger<AdminController> logger,
            IMemoryCache cache,
            IPiiSanitizerService piiSanitizer,
            IHubContext<AdminNotificationHub>? hubContext = null)
        {
            _context = context;
            _configuration = configuration;
            _env = env;
            _syncService = syncService;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _cache = cache;
            _piiSanitizer = piiSanitizer;
            _hubContext = hubContext;
        }

        // ═══════════════════════════════════════════════════════════════
        //  TOKEN GENERATION HELPER
        // ═══════════════════════════════════════════════════════════════

        private string CreateAdminToken(User user, string sessionId)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim("SessionId", sessionId),
                new Claim("IsAdmin", "true"),
                new Claim("MustChangePassword", user.MustChangePassword ? "true" : "false")
            };

            var creds = CoreApi.Extensions.AuthenticationExtensions.GetSigningCredentials(_configuration);

            var issuer = _configuration["Jwt:Issuer"] ?? _configuration["Jwt__Issuer"] ?? "LegalConnect-API";
            var audience = _configuration["Jwt:Audience"] ?? _configuration["Jwt__Audience"] ?? "LegalConnect-Admin";

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(4),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private void SetAdminAuthCookie(string token)
        {
            var isSecure = HttpContext.Request.IsHttps || !_env.IsDevelopment();
            var userAgent = HttpContext.Request.Headers["User-Agent"].ToString();

            SameSiteMode sameSiteMode;
            if (_env.IsDevelopment())
            {
                sameSiteMode = SameSiteMode.Lax;
            }
            else if (CoreApi.Services.TokenService.DisallowsSameSiteNone(userAgent))
            {
                sameSiteMode = SameSiteMode.Unspecified;
            }
            else
            {
                sameSiteMode = SameSiteMode.None;
            }

            Response.Cookies.Append("lc_admin_token", token, new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Expires = DateTime.UtcNow.AddHours(4),
                Path = "/"
            });
        }

        private void ClearAdminAuthCookie()
        {
            var isSecure = HttpContext.Request.IsHttps || !_env.IsDevelopment();
            var userAgent = HttpContext.Request.Headers["User-Agent"].ToString();

            SameSiteMode sameSiteMode;
            if (_env.IsDevelopment())
            {
                sameSiteMode = SameSiteMode.Lax;
            }
            else if (CoreApi.Services.TokenService.DisallowsSameSiteNone(userAgent))
            {
                sameSiteMode = SameSiteMode.Unspecified;
            }
            else
            {
                sameSiteMode = SameSiteMode.None;
            }

            Response.Cookies.Delete("lc_admin_token", new CookieOptions
            {
                HttpOnly = true,
                Secure = isSecure,
                SameSite = sameSiteMode,
                Path = "/"
            });
        }

        private void AttachAdminAuthHeader(System.Net.Http.HttpClient httpClient)
        {
            if (Request.Headers.TryGetValue("Authorization", out var authHeader) && !string.IsNullOrWhiteSpace(authHeader))
            {
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", authHeader.ToString());
            }
            else if (Request.Cookies.TryGetValue("lc_admin_token", out var adminCookie) && !string.IsNullOrWhiteSpace(adminCookie))
            {
                httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", $"Bearer {adminCookie}");
            }
        }

        [HttpGet("telemetry/stream")]
        [Authorize(Roles = "Admin")]
        public async Task StreamTelemetry(System.Threading.CancellationToken cancellationToken)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            var initialPayload = System.Text.Json.JsonSerializer.Serialize(new
            {
                type = "connected",
                message = "Admin SSE Telemetry Stream Established",
                timestamp = DateTime.UtcNow
            });

            try
            {
                await Response.WriteAsync($"data: {initialPayload}\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);

                while (!cancellationToken.IsCancellationRequested)
                {
                    await Task.Delay(15000, cancellationToken);

                    var eventPayload = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        type = "ping",
                        timestamp = DateTime.UtcNow,
                        status = "healthy"
                    });

                    await Response.WriteAsync($"data: {eventPayload}\n\n", cancellationToken);
                    await Response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Client disconnected
            }
        }
    }
}