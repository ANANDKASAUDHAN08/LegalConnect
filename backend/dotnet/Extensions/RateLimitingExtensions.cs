using System;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CoreApi.Extensions
{
    /// <summary>
    /// Enterprise Rate Limiting Configuration Engine.
    /// Implements tiered, identity-partitioned, and IP-partitioned defense policies.
    /// Configured via appsettings.json for 12-factor cloud deployment compliance.
    /// </summary>
    public static class RateLimitingExtensions
    {
        public const string AuthPolicyName = "AuthPolicy";
        public const string AuthSessionPolicyName = "AuthSessionPolicy";
        public const string AdminModerationPolicyName = "AdminModerationPolicy";

        public static IServiceCollection AddAppRateLimiting(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            // Dynamic thresholds bound from IConfiguration with resilient defaults
            var authPermitLimit = configuration.GetValue("RateLimiting:Auth:PermitLimit", 30);
            var authSessionPermitLimit = configuration.GetValue("RateLimiting:AuthSession:PermitLimit", 120);
            var adminModerationPermitLimit = configuration.GetValue("RateLimiting:AdminModeration:PermitLimit", 50);

            return services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.HttpContext.Response.ContentType = "application/json";
                    await context.HttpContext.Response.WriteAsync(
                        "{\"error\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests in a short time. Please wait a minute before trying again.\"}",
                        cancellationToken);
                };

                // 1. IP-partitioned rate limit for sensitive auth actions (login, register, reset password)
                options.AddPolicy(AuthPolicyName, httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString()
                            ?? httpContext.Request.Headers["X-Forwarded-For"].ToString()
                            ?? "anonymous",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = authPermitLimit,
                            Window = TimeSpan.FromMinutes(1),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        }));

                // 2. IP-partitioned rate limit for session maintenance (token refresh, logout)
                options.AddPolicy(AuthSessionPolicyName, httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString()
                            ?? httpContext.Request.Headers["X-Forwarded-For"].ToString()
                            ?? "anonymous",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = authSessionPermitLimit,
                            Window = TimeSpan.FromMinutes(1),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        }));

                // 3. Identity-partitioned rate limit for admin moderation actions (resolve, dismiss, bulk, claim, escalate)
                // Partitioned primarily by authenticated Admin Email, falling back to client IP.
                options.AddPolicy(AdminModerationPolicyName, httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: httpContext.User?.FindFirst(ClaimTypes.Email)?.Value
                            ?? httpContext.Connection.RemoteIpAddress?.ToString()
                            ?? "anonymous-admin",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = adminModerationPermitLimit,
                            Window = TimeSpan.FromMinutes(1),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        }));
            });
        }
    }
}