using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Middleware;

/// <summary>
/// Automatically writes AuditLog entries for significant SAP write operations (POST/PATCH).
/// Lightweight – only fires on successful responses to /api/sap/post and /api/sap/patch.
/// </summary>
public class AuditLogMiddleware
{
    private readonly RequestDelegate _next;

    public AuditLogMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        await _next(context);

        // Only log successful SAP write operations
        if (!ShouldLog(context)) return;

        try
        {
            var userId = context.User.FindFirstValue("preferred_username")
                ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? "unknown";
            var userName = context.User.FindFirstValue("name")
                ?? context.User.FindFirstValue(ClaimTypes.Name)
                ?? userId;

            var tenantIdStr = context.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "0";
            var instanceIdStr = context.Request.Headers["X-Instance-Id"].FirstOrDefault() ?? "0";
            long.TryParse(tenantIdStr, out var tenantId);
            long.TryParse(instanceIdStr, out var instanceId);

            var path = context.Request.Path.Value ?? "";
            var module = ExtractModule(context);
            var action = context.Request.Method == "POST"
                ? $"SAP_POST:{ExtractEndpoint(context)}"
                : $"SAP_PATCH:{ExtractEndpoint(context)}";

            var log = new AuditLog
            {
                UserId = userId,
                UserName = userName,
                Action = action,
                Module = module,
                TenantId = tenantId,
                InstanceId = instanceId,
                IpAddress = context.Connection.RemoteIpAddress?.ToString(),
            };

            db.AuditLogs.Add(log);
            await db.SaveChangesAsync();
        }
        catch
        {
            // Audit log failure must never affect the main request
        }
    }

    private static bool ShouldLog(HttpContext context)
    {
        if (context.Response.StatusCode < 200 || context.Response.StatusCode >= 300) return false;
        if (!context.Request.Method.Equals("POST", StringComparison.OrdinalIgnoreCase) &&
            !context.Request.Method.Equals("PATCH", StringComparison.OrdinalIgnoreCase)) return false;

        var path = context.Request.Path.Value ?? "";
        return path.StartsWith("/api/sap/post", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/sap/patch", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/offline-sync/enqueue", StringComparison.OrdinalIgnoreCase);
    }

    private static string ExtractModule(HttpContext context)
    {
        // Try to extract module from query or body (best-effort, non-blocking)
        var endpoint = context.Request.Query["endpoint"].FirstOrDefault() ?? "";
        return endpoint switch
        {
            var e when e.StartsWith("PickLists") => "Pick",
            var e when e.StartsWith("GoodsReceiptsPO") => "PurchaseDelivery",
            var e when e.StartsWith("DeliveryNotes") => "SalesDelivery",
            var e when e.StartsWith("InventoryCountings") => "InventoryCount",
            var e when e.StartsWith("InventoryTransferRequests") => "InventoryTransfer",
            var e when e.StartsWith("StockTransfers") => "StockTransfer",
            _ => "SAP"
        };
    }

    private static string ExtractEndpoint(HttpContext context)
        => context.Request.Query["endpoint"].FirstOrDefault() ?? context.Request.Path.Value?.Split('/').LastOrDefault() ?? "unknown";
}
