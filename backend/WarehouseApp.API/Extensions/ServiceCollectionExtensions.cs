using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WarehouseApp.Application.Services;
using WarehouseApp.Domain.Interfaces;
using WarehouseApp.Infrastructure.Data;
using WarehouseApp.Infrastructure.Data.Repositories;
using WarehouseApp.Infrastructure.Sap;

namespace WarehouseApp.API.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWarehouseServices(this IServiceCollection services, IConfiguration config)
    {
        // Database
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(config.GetConnectionString("DefaultConnection"),
                npgsql => npgsql.MigrationsAssembly("WarehouseApp.Infrastructure")));

        // Repositories & Unit of Work
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Application Services
        services.AddScoped<DocumentCacheService>();
        services.AddScoped<DocumentLockService>();
        services.AddSingleton<SapSessionService>();
        services.AddScoped<OfflineSyncService>();

        // SAP Client Factory
        services.AddSingleton<SapClientFactory>();

        // HTTP Client for SAP (ignore SSL errors – SAP uses self-signed certs)
        services.AddHttpClient("SapServiceLayer")
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (_, _, _, _) => true
            });

        // Memory Cache (for SAP sessions)
        services.AddMemoryCache();

        return services;
    }

    public static IServiceCollection AddWarehouseAuth(this IServiceCollection services, IConfiguration config)
    {
        var keycloakConfig = config.GetSection("Keycloak");
        var authority = keycloakConfig["Authority"] ?? throw new InvalidOperationException("Keycloak:Authority missing");
        var audience = keycloakConfig["Audience"] ?? "account";

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = authority;
                options.Audience = audience;
                options.RequireHttpsMetadata = false; // Allow HTTP in dev/internal
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ClockSkew = TimeSpan.FromMinutes(5)
                };
                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = ctx =>
                    {
                        ctx.Response.Headers["WWW-Authenticate"] = "Bearer";
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
            options.AddPolicy("SupervisorOrAbove", policy => policy.RequireRole("Admin", "Supervisor"));
            options.AddPolicy("WarehouseAccess", policy => policy.RequireRole("Admin", "Supervisor", "Warehouse"));
        });

        return services;
    }

    public static IServiceCollection AddWarehouseCors(this IServiceCollection services, IConfiguration config)
    {
        var allowedOrigins = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:3000"];

        services.AddCors(options =>
        {
            options.AddPolicy("WarehousePolicy", policy =>
                policy.WithOrigins(allowedOrigins)
                      .AllowAnyMethod()
                      .AllowAnyHeader()
                      .AllowCredentials());
        });

        return services;
    }
}
