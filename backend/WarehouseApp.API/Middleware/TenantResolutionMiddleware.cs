using Microsoft.EntityFrameworkCore;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Middleware;

/// <summary>
/// Resolves tenant and instance from JWT claims or request headers.
/// Populates IRequestContext for downstream services.
/// </summary>
public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantResolutionMiddleware> _logger;

    public TenantResolutionMiddleware(RequestDelegate next, ILogger<TenantResolutionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        // Skip for health/auth endpoints
        var path = context.Request.Path.Value ?? "";
        if (path.StartsWith("/health") || path.StartsWith("/swagger") || path.StartsWith("/api/auth"))
        {
            await _next(context);
            return;
        }

        // Instance resolution: header takes priority, then first available
        long instanceId = 0;
        if (context.Request.Headers.TryGetValue("X-Instance-Id", out var instanceHeader)
            && long.TryParse(instanceHeader, out var parsedInstance))
        {
            instanceId = parsedInstance;
        }

        // Tenant resolution: header or JWT claim
        long tenantId = 0;
        if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader)
            && long.TryParse(tenantHeader, out var parsedTenant))
        {
            tenantId = parsedTenant;
        }

        context.Items["InstanceId"] = instanceId;
        context.Items["TenantId"] = tenantId;

        await _next(context);
    }
}
