using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace CoreApi.Extensions
{
    /// <summary>
    /// Enterprise Server Security & Kestrel Hardening.
    /// Defends against connection starvation, Slowloris attacks, and server fingerprinting.
    /// </summary>
    public static class ServerSecurityExtensions
    {
        public static ConfigureWebHostBuilder ConfigureKestrelHardening(this ConfigureWebHostBuilder webHost)
        {
            webHost.ConfigureKestrel(serverOptions =>
            {
                // 1. Suppress the 'Server: Kestrel' response header (prevents server fingerprinting)
                serverOptions.AddServerHeader = false;

                // 2. Request body size limit: 50MB (mirrors reverse proxy client_max_body_size)
                serverOptions.Limits.MaxRequestBodySize = 50 * 1024 * 1024;

                // 3. Anti-Slowloris: Enforce timeout on incoming header reception (30s)
                serverOptions.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);

                // 4. Keep-alive connection idle timeout (2 minutes)
                serverOptions.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);

                // 5. Minimum data rate for request body streaming (prevents slow upload starvation)
                serverOptions.Limits.MinRequestBodyDataRate = new MinDataRate(bytesPerSecond: 240, gracePeriod: TimeSpan.FromSeconds(5));
            });

            return webHost;
        }
    }
}