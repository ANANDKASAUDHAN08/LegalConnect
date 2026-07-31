using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CoreApi.Data;
using CoreApi.Models;
using CoreApi.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

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

        public AdminController(
            AppDbContext context,
            IConfiguration configuration,
            IWebHostEnvironment env,
            ILawyerSyncService syncService,
            IHttpClientFactory httpClientFactory,
            ILogger<AdminController> logger,
            IMemoryCache cache)
        {
            _context = context;
            _configuration = configuration;
            _env = env;
            _syncService = syncService;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _cache = cache;
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
                new Claim("IsAdmin", "true")
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                _configuration.GetSection("Jwt:Key").Value!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddHours(4),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        [HttpGet("telemetry/stream")]
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

    // ═══════════════════════════════════════════════════════════════
    //  ADMIN DTOs
    // ═══════════════════════════════════════════════════════════════

    public class AdminUpdateUserDto
    {
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public string? Phone { get; set; }
        public string? ClientCity { get; set; }
        public string? ClientState { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsEmailVerified { get; set; }
    }

    public class AdminUpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    public class AnnouncementCreateDto
    {
        public string Version { get; set; } = "1.0.0";
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? DetailsMarkdown { get; set; }
        public AnnouncementType Type { get; set; } = AnnouncementType.MajorRelease;
        public bool IsModalTrigger { get; set; } = true;
        public bool IsActive { get; set; } = true;
        public DateTime? PublishedAt { get; set; }
    }

    public class AdminVerifyLawyerDto
    {
        public bool IsVerified { get; set; }
    }

    public class AdminUpdateLawyerProfileDto
    {
        public string? BarCouncilNumber { get; set; }
        public string? Specialization { get; set; }
        public int? ExperienceYears { get; set; }
        public string? City { get; set; }
        public decimal? ConsultationFee { get; set; }
        public decimal? InPersonFee { get; set; }
        public string? OfficeAddress { get; set; }
        public string? Bio { get; set; }
        public bool? IsAvailable { get; set; }
        public bool? IsVerified { get; set; }
    }
}
