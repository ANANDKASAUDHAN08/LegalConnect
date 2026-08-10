using System.IO;
using System.Text;
using CoreApi.Data;
using CoreApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.ResponseCompression;
using LegalConnect.Middleware;
using CoreApi.Hubs.Admin;
using CoreApi.Services.Admin;

var builder = WebApplication.CreateBuilder(args);

// Load optional local configuration (git ignored for private keys)
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Add services to the container.
builder.Services.AddHealthChecks();
builder.Services.AddMemoryCache();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
    });

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IVerificationService, VerificationService>();
builder.Services.AddScoped<IUserProfileService, UserProfileService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ILawyerSyncService, LawyerSyncService>();
builder.Services.AddSingleton<IPiiSanitizerService, PiiSanitizerService>();
builder.Services.AddHttpClient();
builder.Services.AddHostedService<ProfileSyncWorker>();
builder.Services.AddHostedService<AdminNotificationDigestService>();
builder.Services.AddHostedService<AdminNotificationSyncWorker>();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(
                  "http://localhost:4200",
                  "http://localhost:4201",
                  "http://localhost:4300",
                  "https://legalconnect-501109.web.app",
                  "https://legalconnect-501109.firebaseapp.com",
                  "https://legalconnect-admin.web.app",
                  "https://legalconnect-admin.firebaseapp.com",
                  "https://admin.legalconnect-501109.web.app"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

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

var envConnStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? Environment.GetEnvironmentVariable("DefaultConnection");

var connectionString = !string.IsNullOrEmpty(envConnStr)
    ? envConnStr
    : (builder.Configuration.GetConnectionString("DefaultConnection") ?? builder.Configuration["ConnectionStrings__DefaultConnection"]);

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
                // Prefer the Authorization Bearer header (set by Angular interceptor)
                // over the cookie. This prevents stale cookies from overriding valid tokens.
                var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
                {
                    // Let the default JwtBearer handler extract the token from the header
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
                var dbContext = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var sessionIdClaim = context.Principal?.FindFirst("SessionId")?.Value;
                if (string.IsNullOrEmpty(sessionIdClaim))
                {
                    context.Fail("Session claim is missing.");
                    return;
                }
                var sessionExists = await dbContext.ActiveSessions.AnyAsync(s => s.TokenId == sessionIdClaim);
                if (!sessionExists)
                {
                    context.Fail("Session has been revoked.");
                }
            }
        };
    });

var app = builder.Build();

// Seed & migrate data (safely wrapped so startup succeeds even if DB is unavailable)
try
{
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        
        // 1. Seed data & auto-migrate missing columns in MySQL tables (Users, Consultations)
        DbSeeder.Seed(context, app.Configuration);

        // 2. Production-grade migration sync: reconcile EF migration history with existing MySQL schema
        DbSeeder.SynchronizeEFMigrationsHistory(context);

        // 3. Apply any remaining EF migrations automatically
        try { context.Database.Migrate(); } catch { }
    }
}
catch (Exception ex)
{
    Console.WriteLine($"⚠️ Database seeding/migration skipped on startup: {ex.Message}");
}

app.UseMiddleware<GlobalExceptionMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();
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

app.UseCors("AllowAngular");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.UseResponseCompression();

app.MapHealthChecks("/api/health");
app.MapControllers();
app.MapHub<AdminNotificationHub>("/hubs/notifications");
app.MapHub<AdminNotificationHub>("/hubs/admin/notifications");

app.Run();

public class UtcDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime>
{
    public override DateTime Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        return DateTime.Parse(reader.GetString()!).ToUniversalTime();
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime value, System.Text.Json.JsonSerializerOptions options)
    {
        var utcValue = value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        writer.WriteStringValue(utcValue.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
    }
}