using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using WarehouseApp.API.BackgroundServices;
using WarehouseApp.API.Extensions;
using WarehouseApp.API.Middleware;
using WarehouseApp.Infrastructure.Data;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("logs/warehouse-app-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    // Services
    builder.Services.AddWarehouseServices(builder.Configuration);
    builder.Services.AddWarehouseAuth(builder.Configuration);
    builder.Services.AddWarehouseCors(builder.Configuration);

    builder.Services.AddControllers()
        .AddJsonOptions(opts =>
        {
            // Use camelCase (ASP.NET Core default) so the React frontend can access
            // properties as e.g. t.id, t.name, t.slUrl without extra mapping.
            opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            opts.JsonSerializerOptions.DefaultIgnoreCondition =
                System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        });

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "Warehouse App API", Version = "v1" });
        c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "Enter JWT token"
        });
        c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
        {
            {
                new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference = new Microsoft.OpenApi.Models.OpenApiReference
                        { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" }
                },
                Array.Empty<string>()
            }
        });
    });

    builder.Services.AddHealthChecks()
        .AddDbContextCheck<AppDbContext>();

    // Background services
    builder.Services.AddHostedService<OfflineSyncBackgroundService>();

    var app = builder.Build();

    // Bootstrap database on startup.
    // MigrateAsync applies pending EF migrations if they exist.
    // EnsureCreatedAsync creates all tables from the model if no migrations are present
    // (first deployment or dev environment without migration files).
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        try
        {
            var pendingMigrations = (await db.Database.GetPendingMigrationsAsync()).ToList();
            if (pendingMigrations.Count > 0)
            {
                await db.Database.MigrateAsync();
                Log.Information("Applied {Count} pending migration(s)", pendingMigrations.Count);
            }
            else
            {
                // No migrations found – create schema directly from EF model
                await db.Database.EnsureCreatedAsync();
                Log.Information("Database schema ensured (EnsureCreated)");
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Migration failed, attempting EnsureCreated as fallback");
            await db.Database.EnsureCreatedAsync();
        }
    }

    // Pipeline
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Warehouse App API v1"));

    app.UseMiddleware<RequestLoggingMiddleware>();
    app.UseCors("WarehousePolicy");
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseMiddleware<TenantResolutionMiddleware>();
    app.UseMiddleware<AuditLogMiddleware>();

    app.MapControllers();
    app.MapHealthChecks("/health");

    app.MapGet("/", () => Results.Redirect("/swagger"));

    Log.Information("Warehouse App API starting on {Environment}", app.Environment.EnvironmentName);
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
