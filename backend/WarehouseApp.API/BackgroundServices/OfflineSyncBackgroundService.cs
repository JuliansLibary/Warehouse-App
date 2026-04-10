using Microsoft.EntityFrameworkCore;
using WarehouseApp.Application.Services;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.BackgroundServices;

/// <summary>
/// Hosted background service that periodically processes the offline sync queue.
/// Runs every 5 minutes, applies exponential backoff per entry (max 5 retries).
/// Automatically retries "Failed" entries whose retry window has passed.
/// </summary>
public class OfflineSyncBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OfflineSyncBackgroundService> _logger;
    private static readonly TimeSpan _interval = TimeSpan.FromMinutes(5);

    // Retry backoff: attempt 1→2min, 2→5min, 3→15min, 4→30min, 5→60min
    private static readonly TimeSpan[] _retryBackoff =
    [
        TimeSpan.FromMinutes(2),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromHours(1),
    ];

    public OfflineSyncBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<OfflineSyncBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OfflineSyncBackgroundService started. Interval: {Interval}", _interval);

        // Small startup delay to let the application fully initialize
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessRetryableEntriesAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "OfflineSyncBackgroundService encountered an error");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task ProcessRetryableEntriesAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sapFactory = scope.ServiceProvider.GetRequiredService<WarehouseApp.Infrastructure.Sap.SapClientFactory>();
        var sessionService = scope.ServiceProvider.GetRequiredService<SapSessionService>();

        // Find all "Failed" entries that are eligible for retry
        var now = DateTime.UtcNow;
        var retryable = await db.OfflineSyncEntries
            .Where(e => e.Status == "Failed"
                && e.RetryCount < _retryBackoff.Length
                && e.UpdatedAt < now) // use UpdatedAt as last attempt time
            .Include(e => e.Tenant)
            .ThenInclude(t => t.Instance)
            .OrderBy(e => e.UpdatedAt)
            .ToListAsync(ct);

        // Also find "Pending" entries older than 10 minutes (frontend never triggered sync)
        var stalePending = await db.OfflineSyncEntries
            .Where(e => e.Status == "Pending" && e.CreatedAt < now.AddMinutes(-10))
            .Include(e => e.Tenant)
            .ThenInclude(t => t.Instance)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync(ct);

        var toProcess = retryable
            .Where(e => IsEligibleForRetry(e, now))
            .Concat(stalePending)
            .ToList();

        if (toProcess.Count == 0) return;

        _logger.LogInformation("OfflineSyncBackgroundService: processing {Count} entries", toProcess.Count);

        foreach (var entry in toProcess)
        {
            ct.ThrowIfCancellationRequested();

            var instance = entry.Tenant?.Instance;
            if (instance == null)
            {
                _logger.LogWarning("Entry {Id} has no instance – skipping", entry.Id);
                continue;
            }

            try
            {
                entry.Status = "Processing";
                await db.SaveChangesAsync(ct);

                var sapClient = sapFactory.Create(instance);
                var sessionToken = sessionService.GetSession(entry.UserId, instance.Id);
                var payload = System.Text.Json.JsonSerializer.Deserialize<object>(entry.PayloadJson);

                var success = entry.ActionType.ToUpper() switch
                {
                    "POST" => (await sapClient.PostAsync<object>(entry.SapEndpoint, payload!, sessionToken, ct)).Success,
                    "PATCH" => (await sapClient.PatchAsync<object>(entry.SapEndpoint, payload!, sessionToken, ct)).Success,
                    "DELETE" => (await sapClient.DeleteAsync(entry.SapEndpoint, sessionToken, ct)).Success,
                    _ => false
                };

                entry.Status = success ? "Done" : "Failed";
                entry.ProcessedAt = DateTime.UtcNow;
                entry.RetryCount++;
                if (!success) entry.ErrorMessage = "SAP returned failure on background retry";

                _logger.LogInformation("Entry {Id} ({Module}): {Status} (retry #{Retry})",
                    entry.Id, entry.Module, entry.Status, entry.RetryCount);
            }
            catch (Exception ex)
            {
                entry.Status = "Failed";
                entry.ErrorMessage = ex.Message;
                entry.RetryCount++;
                _logger.LogError(ex, "Background retry failed for entry {Id}", entry.Id);
            }

            await db.SaveChangesAsync(ct);
        }
    }

    private static bool IsEligibleForRetry(WarehouseApp.Domain.Entities.OfflineSyncEntry entry, DateTime now)
    {
        var retryIndex = Math.Min(entry.RetryCount, _retryBackoff.Length - 1);
        var backoff = _retryBackoff[retryIndex];
        return entry.UpdatedAt.Add(backoff) <= now;
    }
}
