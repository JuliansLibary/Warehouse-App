using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Application.Services;

/// <summary>
/// Processes the offline sync queue.
/// Replays pending operations against SAP when connectivity is restored.
/// </summary>
public class OfflineSyncService
{
    private readonly IRepository<OfflineSyncEntry> _repo;
    private readonly ISapServiceLayerClient _sapClient;
    private readonly SapSessionService _sessionService;
    private readonly IUnitOfWork _uow;
    private readonly ILogger<OfflineSyncService> _logger;

    public OfflineSyncService(
        IRepository<OfflineSyncEntry> repo,
        ISapServiceLayerClient sapClient,
        SapSessionService sessionService,
        IUnitOfWork uow,
        ILogger<OfflineSyncService> logger)
    {
        _repo = repo;
        _sapClient = sapClient;
        _sessionService = sessionService;
        _uow = uow;
        _logger = logger;
    }

    public async Task<OfflineSyncEntry> EnqueueAsync(
        string userId, string module, string actionType,
        string sapEndpoint, string payloadJson, long tenantId,
        CancellationToken ct = default)
    {
        var entry = new OfflineSyncEntry
        {
            UserId = userId,
            Module = module,
            ActionType = actionType,
            SapEndpoint = sapEndpoint,
            PayloadJson = payloadJson,
            TenantId = tenantId,
            Status = "Pending"
        };

        return await _repo.AddAsync(entry, ct);
    }

    public async Task<IEnumerable<OfflineSyncEntry>> GetPendingAsync(string userId, long tenantId, CancellationToken ct = default)
        => await _repo.FindAsync(e => e.UserId == userId && e.TenantId == tenantId && e.Status == "Pending", ct);

    public async Task ProcessPendingAsync(string userId, long instanceId, long tenantId, CancellationToken ct = default)
    {
        var pending = await GetPendingAsync(userId, tenantId, ct);
        var sessionToken = _sessionService.GetSession(userId, instanceId);

        foreach (var entry in pending.OrderBy(e => e.CreatedAt))
        {
            try
            {
                entry.Status = "Processing";
                await _uow.SaveChangesAsync(ct);

                var payload = System.Text.Json.JsonSerializer.Deserialize<object>(entry.PayloadJson);

                var success = entry.ActionType.ToUpper() switch
                {
                    "POST" => (await _sapClient.PostAsync<object>(entry.SapEndpoint, payload!, sessionToken, ct)).Success,
                    "PATCH" => (await _sapClient.PatchAsync<object>(entry.SapEndpoint, payload!, sessionToken, ct)).Success,
                    "DELETE" => (await _sapClient.DeleteAsync(entry.SapEndpoint, sessionToken, ct)).Success,
                    _ => false
                };

                entry.Status = success ? "Done" : "Failed";
                entry.ProcessedAt = DateTime.UtcNow;
                if (!success) entry.ErrorMessage = "SAP returned failure";
            }
            catch (Exception ex)
            {
                entry.Status = "Failed";
                entry.ErrorMessage = ex.Message;
                entry.RetryCount++;
                _logger.LogError(ex, "Failed to process offline sync entry {Id}", entry.Id);
            }

            await _uow.SaveChangesAsync(ct);
        }
    }
}
