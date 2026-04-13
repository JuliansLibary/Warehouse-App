using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Application.Services;

/// <summary>
/// Manages SAP Service Layer sessions per user+instance.
/// For Cookie mode: caches B1SESSION tokens.
/// For BasicAuth mode: caches the Basic auth header.
/// </summary>
public class SapSessionService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<SapSessionService> _logger;

    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(8);

    public SapSessionService(IMemoryCache cache, ILogger<SapSessionService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    private static string CacheKey(string userId, long instanceId) => $"sap_session:{userId}:{instanceId}";

    public void StoreSession(string userId, long instanceId, string sessionToken)
    {
        _cache.Set(CacheKey(userId, instanceId), sessionToken, SessionTtl);
        _logger.LogDebug("SAP session stored for user {UserId} on instance {InstanceId}", userId, instanceId);
    }

    public string? GetSession(string userId, long instanceId)
        => _cache.TryGetValue(CacheKey(userId, instanceId), out string? token) ? token : null;

    public void RemoveSession(string userId, long instanceId)
    {
        _cache.Remove(CacheKey(userId, instanceId));
        _logger.LogDebug("SAP session removed for user {UserId} on instance {InstanceId}", userId, instanceId);
    }

    public bool HasSession(string userId, long instanceId)
        => _cache.TryGetValue(CacheKey(userId, instanceId), out _);
}
