using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Application.Services;

/// <summary>
/// Soft document locking to prevent concurrent edits.
/// Lock expires after configurable timeout (default 30 minutes).
/// </summary>
public class DocumentLockService
{
    private readonly IRepository<DocumentLock> _repo;
    private readonly IUnitOfWork _uow;
    private readonly ILogger<DocumentLockService> _logger;

    // Default lock timeout matches the old app's documentLockTimer: 30 minutes
    private const int DefaultLockTimeoutMinutes = 30;

    public DocumentLockService(IRepository<DocumentLock> repo, IUnitOfWork uow, ILogger<DocumentLockService> logger)
    {
        _repo = repo;
        _uow = uow;
        _logger = logger;
    }

    public async Task<(bool IsLocked, string? LockedBy)> CheckLockAsync(
        long documentNumber, string module, long tenantId,
        int timeoutMinutes = DefaultLockTimeoutMinutes,
        CancellationToken ct = default)
    {
        var locks = await _repo.FindAsync(
            l => l.DocumentNumber == documentNumber
              && l.Module == module
              && l.TenantId == tenantId, ct);

        var activeLock = locks.FirstOrDefault();
        if (activeLock == null) return (false, null);

        // Check if lock has expired
        if (DateTime.UtcNow - activeLock.LatestChangeDate > TimeSpan.FromMinutes(timeoutMinutes))
        {
            await _repo.DeleteAsync(activeLock, ct);
            return (false, null);
        }

        return (true, activeLock.LockedByUsername);
    }

    public async Task<bool> AcquireLockAsync(
        long documentNumber, string module, long tenantId,
        long userId, string username,
        CancellationToken ct = default)
    {
        var (isLocked, lockedBy) = await CheckLockAsync(documentNumber, module, tenantId, ct: ct);
        if (isLocked && lockedBy != username)
            return false;

        // Release own existing lock first
        var existingLocks = await _repo.FindAsync(
            l => l.DocumentNumber == documentNumber && l.Module == module && l.TenantId == tenantId, ct);
        foreach (var l in existingLocks)
            await _repo.DeleteAsync(l, ct);

        var newLock = new DocumentLock
        {
            DocumentNumber = documentNumber,
            Module = module,
            TenantId = tenantId,
            LockedByUserId = userId,
            LockedByUsername = username,
            LatestChangeDate = DateTime.UtcNow
        };

        await _repo.AddAsync(newLock, ct);
        return true;
    }

    public async Task RefreshLockAsync(long documentNumber, string module, long tenantId, CancellationToken ct = default)
    {
        var locks = await _repo.FindAsync(
            l => l.DocumentNumber == documentNumber && l.Module == module && l.TenantId == tenantId, ct);

        var activeLock = locks.FirstOrDefault();
        if (activeLock != null)
        {
            activeLock.LatestChangeDate = DateTime.UtcNow;
            await _uow.SaveChangesAsync(ct);
        }
    }

    public async Task ReleaseLockAsync(long documentNumber, string module, long tenantId, CancellationToken ct = default)
    {
        var locks = await _repo.FindAsync(
            l => l.DocumentNumber == documentNumber && l.Module == module && l.TenantId == tenantId, ct);

        foreach (var l in locks)
            await _repo.DeleteAsync(l, ct);
    }
}
