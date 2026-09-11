using System;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using CoreApi.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace CoreApi.Extensions
{
    /// <summary>
    /// Enterprise Authentication Configuration Engine.
    /// Manages JWT token validation, dual transport modes (Bearer Header + Fallback Secure Cookies),
    /// and sliding session validation with two-tier in-memory caching.
    /// </summary>
    public static class AuthenticationExtensions
    {
        public const string DefaultFallbackJwtKey = "SuperSecretKeyForLegalConnectWhichIsLongEnoughToSatisfyHMACSHA512RequirementAndMore";

        public static string ResolveJwtKey(IConfiguration configuration)
        {
            var jwtKey = configuration["Jwt:Key"]
                ?? configuration["Jwt__Key"]
                ?? configuration["JWT__Secret"]
                ?? configuration["JWT_SECRET"]
                ?? configuration["JWT__Key"]
                ?? configuration["JWT_KEY"]
                ?? configuration["JWT:Secret"]
                ?? Environment.GetEnvironmentVariable("Jwt__Key")
                ?? Environment.GetEnvironmentVariable("JWT__Secret")
                ?? Environment.GetEnvironmentVariable("JWT_SECRET")
                ?? Environment.GetEnvironmentVariable("JWT_KEY")
                ?? Environment.GetEnvironmentVariable("Jwt:Key");

            if (string.IsNullOrWhiteSpace(jwtKey))
            {
                jwtKey = DefaultFallbackJwtKey;
            }

            return jwtKey;
        }

        public static SymmetricSecurityKey GetSigningKey(IConfiguration configuration)
        {
            var rawKey = ResolveJwtKey(configuration);
            var keyBytes = Encoding.UTF8.GetBytes(rawKey);

            if (keyBytes.Length < 32)
            {
                var padded = rawKey + DefaultFallbackJwtKey;
                keyBytes = Encoding.UTF8.GetBytes(padded);
            }

            return new SymmetricSecurityKey(keyBytes);
        }

        public static SigningCredentials GetSigningCredentials(IConfiguration configuration)
        {
            var key = GetSigningKey(configuration);
            return new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        }

        public static AuthenticationBuilder AddAppAuthentication(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            var validIssuer = configuration["Jwt:Issuer"] ?? configuration["Jwt__Issuer"] ?? "LegalConnect-API";

            var validAudience = configuration["Jwt:Audience"] ?? configuration["Jwt__Audience"] ?? "LegalConnect-Admin";

            var validAudiences = new List<string>();
            if (!string.IsNullOrEmpty(validAudience)) validAudiences.Add(validAudience);
            if (!validAudiences.Contains("LegalConnect-Admin")) validAudiences.Add("LegalConnect-Admin");
            if (!validAudiences.Contains("LegalConnect-API")) validAudiences.Add("LegalConnect-API");
            if (!validAudiences.Contains("LegalConnect")) validAudiences.Add("LegalConnect");

            return services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = GetSigningKey(configuration),
                        ValidateIssuer = true,
                        ValidIssuer = validIssuer,
                        ValidateAudience = true,
                        ValidAudiences = validAudiences,
                        ClockSkew = TimeSpan.FromMinutes(1) // Enterprise clock skew tolerance
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            // 1. Prefer the standard Authorization Bearer header
                            var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                            {
                                return Task.CompletedTask;
                            }

                            // 2. Dual fallback to HttpOnly cookies for SPA/SSR clients
                            // For admin routes, prioritize lc_admin_token to avoid session confusion
                            if (context.Request.Path.StartsWithSegments("/api/admin", StringComparison.OrdinalIgnoreCase))
                            {
                                if (context.Request.Cookies.TryGetValue("lc_admin_token", out var adminToken))
                                {
                                    context.Token = adminToken;
                                    return Task.CompletedTask;
                                }
                            }

                            if (context.Request.Cookies.TryGetValue("lc_token", out var userToken))
                            {
                                context.Token = userToken;
                            }
                            else if (context.Request.Cookies.TryGetValue("lc_admin_token", out var fallbackAdminToken))
                            {
                                context.Token = fallbackAdminToken;
                            }

                            return Task.CompletedTask;
                        },
                        OnAuthenticationFailed = context =>
                        {
                            var logger = context.HttpContext.RequestServices.GetService<Microsoft.Extensions.Logging.ILoggerFactory>()?.CreateLogger("JwtAuth");
                            logger?.LogWarning("JWT authentication failed: {Message}", context.Exception?.Message);
                            return Task.CompletedTask;
                        },
                        OnTokenValidated = async context =>
                        {
                            var sessionIdClaim = context.Principal?.FindFirst("SessionId")?.Value;
                            if (string.IsNullOrEmpty(sessionIdClaim))
                            {
                                context.Fail("Session claim is missing.");
                                return;
                            }

                            // Two-tier sliding cache lookup: L1 MemoryCache (60s) -> L2 MySQL DB
                            var cache = context.HttpContext.RequestServices.GetRequiredService<IMemoryCache>();
                            var cacheKey = $"ActiveSession_{sessionIdClaim}";

                            if (!cache.TryGetValue(cacheKey, out bool sessionExists))
                            {
                                var dbContext = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                                sessionExists = await dbContext.ActiveSessions.AnyAsync(s => s.TokenId == sessionIdClaim);
                                if (sessionExists)
                                {
                                    cache.Set(cacheKey, true, TimeSpan.FromSeconds(60));
                                }
                            }

                            if (!sessionExists)
                            {
                                context.Fail("Session has been revoked.");
                            }
                        }
                    };
                });
        }
    }
}