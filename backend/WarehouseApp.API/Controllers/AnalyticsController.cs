using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

/// <summary>
/// User performance analytics and activity metrics based on AuditLog entries.
/// Provides insight into: docs processed per user, error rates, module usage.
/// </summary>
[ApiController]
[Route("api/analytics")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnalyticsController(AppDbContext db) => _db = db;

    private string CurrentUserId => User.FindFirstValue("preferred_username")
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "unknown";

    /// <summary>
    /// Returns activity summary per user for the given tenant and date range.
    /// </summary>
    [HttpGet("user-performance")]
    public async Task<IActionResult> GetUserPerformance(
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var logs = await _db.AuditLogs
            .Where(a => a.TenantId == tenantId && a.CreatedAt >= start && a.CreatedAt <= end)
            .ToListAsync(ct);

        var perUser = logs
            .GroupBy(a => new { a.UserId, a.UserName })
            .Select(g => new UserPerformanceDto(
                UserId: g.Key.UserId,
                UserName: g.Key.UserName,
                TotalActions: g.Count(),
                ActionsByModule: g.GroupBy(a => a.Module)
                    .ToDictionary(m => m.Key, m => m.Count()),
                ErrorCount: g.Count(a => a.Action.Contains("Error") || a.Action.Contains("Failed")),
                LastActivity: g.Max(a => a.CreatedAt)
            ))
            .OrderByDescending(u => u.TotalActions)
            .ToList();

        return Ok(perUser);
    }

    /// <summary>
    /// Returns module usage statistics for the tenant.
    /// </summary>
    [HttpGet("module-usage")]
    public async Task<IActionResult> GetModuleUsage(
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        var start = from ?? DateTime.UtcNow.AddDays(-30);
        var end = to ?? DateTime.UtcNow;

        var logs = await _db.AuditLogs
            .Where(a => a.TenantId == tenantId && a.CreatedAt >= start && a.CreatedAt <= end)
            .ToListAsync(ct);

        var byModule = logs
            .GroupBy(a => a.Module)
            .Select(g => new ModuleUsageDto(
                Module: g.Key,
                TotalActions: g.Count(),
                UniqueUsers: g.Select(a => a.UserId).Distinct().Count(),
                Errors: g.Count(a => a.Action.Contains("Error") || a.Action.Contains("Failed")),
                LastUsed: g.Max(a => a.CreatedAt)
            ))
            .OrderByDescending(m => m.TotalActions)
            .ToList();

        return Ok(byModule);
    }

    /// <summary>
    /// Returns a daily activity time series for charting.
    /// </summary>
    [HttpGet("daily-activity")]
    public async Task<IActionResult> GetDailyActivity(
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        [FromQuery] int days = 30,
        CancellationToken ct = default)
    {
        var start = DateTime.UtcNow.AddDays(-days).Date;

        var logs = await _db.AuditLogs
            .Where(a => a.TenantId == tenantId && a.CreatedAt >= start)
            .ToListAsync(ct);

        var daily = logs
            .GroupBy(a => a.CreatedAt.Date)
            .Select(g => new DailyActivityDto(
                Date: g.Key,
                TotalActions: g.Count(),
                UniqueUsers: g.Select(a => a.UserId).Distinct().Count(),
                Errors: g.Count(a => a.Action.Contains("Error") || a.Action.Contains("Failed"))
            ))
            .OrderBy(d => d.Date)
            .ToList();

        // Fill in missing days with zeros
        var result = new List<DailyActivityDto>();
        for (var d = start; d <= DateTime.UtcNow.Date; d = d.AddDays(1))
        {
            var existing = daily.FirstOrDefault(x => x.Date == d);
            result.Add(existing ?? new DailyActivityDto(d, 0, 0, 0));
        }

        return Ok(result);
    }

    /// <summary>
    /// Returns recent audit log entries for review.
    /// </summary>
    [HttpGet("recent-activity")]
    public async Task<IActionResult> GetRecentActivity(
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        [FromQuery] int limit = 100,
        [FromQuery] string? module = null,
        [FromQuery] string? userId = null,
        CancellationToken ct = default)
    {
        var query = _db.AuditLogs
            .Where(a => a.TenantId == tenantId);

        if (!string.IsNullOrEmpty(module))
            query = query.Where(a => a.Module == module);

        if (!string.IsNullOrEmpty(userId))
            query = query.Where(a => a.UserId == userId);

        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Take(Math.Min(limit, 500))
            .Select(a => new RecentActivityDto(
                a.Id, a.UserId, a.UserName, a.Action, a.Module,
                a.EntityType, a.EntityId, a.CreatedAt, a.IpAddress))
            .ToListAsync(ct);

        return Ok(logs);
    }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

public record UserPerformanceDto(
    string UserId, string UserName,
    int TotalActions, Dictionary<string, int> ActionsByModule,
    int ErrorCount, DateTime LastActivity);

public record ModuleUsageDto(
    string Module, int TotalActions, int UniqueUsers, int Errors, DateTime LastUsed);

public record DailyActivityDto(DateTime Date, int TotalActions, int UniqueUsers, int Errors);

public record RecentActivityDto(
    long Id, string UserId, string UserName, string Action, string Module,
    string? EntityType, string? EntityId, DateTime CreatedAt, string? IpAddress);
