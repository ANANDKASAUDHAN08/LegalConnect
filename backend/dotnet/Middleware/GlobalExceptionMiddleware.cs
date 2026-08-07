using System;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LegalConnect.Middleware
{
    public class GlobalExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<GlobalExceptionMiddleware> _logger;
        private readonly IHostEnvironment _env;

        public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IHostEnvironment env)
        {
            _next = next;
            _logger = logger;
            _env = env;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                var errorId = Guid.NewGuid().ToString("N");
                _logger.LogError(ex, "[ErrorId: {ErrorId}] Unhandled exception during HTTP request: {Path}", errorId, context.Request.Path);

                await HandleExceptionAsync(context, ex, errorId);
            }
        }

        private static readonly JsonSerializerOptions StandardJsonOptions = new JsonSerializerOptions 
        { 
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
        };

        private Task HandleExceptionAsync(HttpContext context, Exception exception, string errorId)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var response = new
            {
                statusCode = context.Response.StatusCode,
                message = _env.IsDevelopment() ? exception.Message : "An unexpected server error occurred. Please try again later.",
                errorId = errorId,
                timestamp = DateTime.UtcNow
            };

            return context.Response.WriteAsync(JsonSerializer.Serialize(response, StandardJsonOptions));
        }
    }
}