using System;
using System.IO;
using System.Text.Json.Serialization;
using CoreApi.Converters;
using CoreApi.Data;
using CoreApi.Extensions;
using CoreApi.Hubs.Admin;
using CoreApi.Services;
using CoreApi.Services.Admin;
using LegalConnect.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// ── 0. Enterprise Server Hardening (Anti-Slowloris & Fingerprinting) ──
builder.WebHost.ConfigureKestrelHardening();

// Load optional local configuration (git-ignored for private keys)
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// ── 1. Core Services & JSON Serialization ──
builder.Services.AddAppHealthChecks();
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
builder.Services.AddHostedService<ModerationSlaEscalationWorker>();

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

// ── 6. Tiered Rate Limiting Policies (Configured via RateLimitingExtensions) ──
builder.Services.AddAppRateLimiting(builder.Configuration);

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

// ── 8. JWT Authentication & Sliding Session Verification (Configured via AuthenticationExtensions) ──
builder.Services.AddAppAuthentication(builder.Configuration);

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

// F. Authentication & authorization MUST run BEFORE rate limiter
// so identity-partitioned rate policies can resolve HttpContext.User claims.
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AdminMustChangePasswordMiddleware>();
app.UseRateLimiter();

// G. Health probe endpoint (Kubernetes / load balancer deep health check)
app.MapAppHealthChecks();

// H. Route endpoint mappings
app.MapControllers();
app.MapHub<AdminNotificationHub>("/hubs/admin/notifications");

// ── 10. Database Migration & Seeding Engine (Single Asynchronous Pass) ──
await app.InitializeAndMigrateDatabaseAsync();

await app.RunAsync();