using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace LegalConnect.Middleware
{
    /// <summary>
    /// Enterprise Security Middleware (BE-27):
    /// Enforces mandatory password rotation on first login for accounts seeded with default credentials.
    /// Blocks access to all administrative desks until the administrator updates their password.
    /// </summary>
    public class AdminMustChangePasswordMiddleware
    {
        private readonly RequestDelegate _next;

        public AdminMustChangePasswordMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var user = context.User;

            if (user?.Identity?.IsAuthenticated == true)
            {
                var mustChange = user.FindFirst("MustChangePassword")?.Value;
                if (string.Equals(mustChange, "true", StringComparison.OrdinalIgnoreCase))
                {
                    var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

                    // Enforce only on administrative API routes
                    if (path.StartsWith("/api/admin"))
                    {
                        // Allow endpoints necessary to complete password rotation, check status, or log out
                        bool isAllowed = path.EndsWith("/account/password") ||
                                         path.EndsWith("/account") ||
                                         path.EndsWith("/auth/me") ||
                                         path.EndsWith("/me") ||
                                         path.EndsWith("/auth/logout") ||
                                         path.EndsWith("/logout") ||
                                         path.EndsWith("/auth/login");

                        if (!isAllowed)
                        {
                            context.Response.StatusCode = StatusCodes.Status403Forbidden;
                            context.Response.ContentType = "application/json";

                            var payload = new
                            {
                                success = false,
                                errorCode = "PASSWORD_CHANGE_REQUIRED",
                                message = "Administrative access restricted: You must change your temporary/default password before accessing other features."
                            };

                            await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
                            return;
                        }
                    }
                }
            }

            await _next(context);
        }
    }
}