using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using System.Threading.Tasks;
using CoreApi.Converters;
using CoreApi.Data;
using CoreApi.Extensions;
using CoreApi.Hubs.Admin;
using CoreApi.Services;
using CoreApi.Services.Admin;
using LegalConnect.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Load optional local configuration (git-ignored for private keys)
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// ── 1. Core Services & Controllers ──
builder.Services.AddHealthChecks();
builder.Services.AddMemoryCache();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// ── 2. High-Performance Response Compression (Brotli + Gzip) ──
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

// ── 3. Application Domain Services ──
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IVerificationService, VerificationService>();
builder.Services.AddScoped<IUserProfileService, UserProfileService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ILawyerSyncService, LawyerSyncService>();
builder.Services.AddSingleton<IPiiSanitizerService, PiiSanitizerService>();
builder.Services.AddHttpClient();

// ── 4. Hosted Background Workers ──
builder.Services.AddHostedService<ProfileSyncWorker>();
builder.Services.AddHostedService<AdminNotificationDigestService>();
builder.Services.AddHostedService<AdminNotificationSyncWorker>();

builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── 5. Dynamic CORS (Configured via appsettings.json or environment) ──
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[]
    {
        "http://localhost:4200",
        "http://localhost:4201",
        "http://localhost:4300",
        "https://legalconnect-501109.web.app",
        "https://legalconnect-501109.firebaseapp.com",
        "https://legalconnect-admin.web.app",
        "https://legalconnect-admin.firebaseapp.com",
        "https://admin.legalconnect-501109.web.app"
    };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ── 6. Tiered Rate Limiting Policies ──
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"message\":\"Too many requests in a short time. Please wait a minute before trying again.\"}",
            cancellationToken);
    };

    // IP-partitioned rate limit for sensitive auth actions (login, register, reset password)
    options.AddPolicy("AuthPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString()
                ?? httpContext.Request.Headers["X-Forwarded-For"].ToString()
                ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30, // 30 login/auth attempts per minute per IP
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // IP-partitioned rate limit for session maintenance (token refresh, logout)
    options.AddPolicy("AuthSessionPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString()
                ?? httpContext.Request.Headers["X-Forwarded-For"].ToString()
                ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120, // 120 refresh/logout requests per minute per IP
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

// ── 7. Database Context with Resilient Connection Pooling ──
var envConnStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? Environment.GetEnvironmentVariable("DefaultConnection");

var connectionString = !string.IsNullOrEmpty(envConnStr)
    ? envConnStr
    : (builder.Configuration.GetConnectionString("DefaultConnection")
       ?? builder.Configuration["ConnectionStrings__DefaultConnection"]);

if (string.IsNullOrEmpty(connectionString))
{
    throw new InvalidOperationException("Required configuration 'ConnectionStrings:DefaultConnection' is missing.");
}

var serverVersion = new MySqlServerVersion(new Version(8, 0, 31));
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, serverVersion, mySqlOptions =>
        mySqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null)));

// ── 8. JWT Authentication & Sliding Session Verification ──
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtKey = builder.Configuration["Jwt:Key"]
            ?? builder.Configuration["Jwt__Key"];

        if (string.IsNullOrEmpty(jwtKey))
        {
            throw new InvalidOperationException("Required configuration 'Jwt:Key' is missing.");
        }

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = false,
            ValidateAudience = false
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // Prefer the Authorization Bearer header over cookie
                var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
                {
                    return Task.CompletedTask;
                }
                // Fallback to cookie for SSR or non-SPA clients
                if (context.Request.Cookies.ContainsKey("lc_token"))
                {
                    context.Token = context.Request.Cookies["lc_token"];
                }
                else if (context.Request.Cookies.ContainsKey("lc_admin_token"))
                {
                    context.Token = context.Request.Cookies["lc_admin_token"];
                }
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

var app = builder.Build();

// ── 9. HTTP Middleware Pipeline (Strict Enterprise Order) ──

// A. Global error interception (top of pipeline)
app.UseMiddleware<GlobalExceptionMiddleware>();

// B. Response compression (must wrap all outgoing content streams)
app.UseResponseCompression();

// C. API documentation
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// D. CORS (must precede static files and authentication)
app.UseCors("AllowAngular");

// E. Static asset streaming with uploads directory initialization
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

// F. Traffic shaping & security
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// G. Health probe endpoint (Kubernetes / load balancer standard)
app.MapHealthChecks("/api/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var payload = JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            activeConnections = 1,
            timestamp = DateTime.UtcNow
        });
        await context.Response.WriteAsync(payload);
    }
});

// H. Route endpoint mappings
app.MapControllers();
app.MapHub<AdminNotificationHub>("/hubs/notifications");
app.MapHub<AdminNotificationHub>("/hubs/admin/notifications");

// ── 10. Database Migration & Seeding Engine (Single Asynchronous Pass) ──
await app.InitializeAndMigrateDatabaseAsync();

await app.RunAsync();