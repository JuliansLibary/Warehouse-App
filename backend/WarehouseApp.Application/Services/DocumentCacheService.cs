using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Application.Services;

/// <summary>
/// Replaces the workers.js background-save logic from the old app.
/// Documents are auto-saved to PostgreSQL during editing.
/// </summary>
public class DocumentCacheService
{
    private readonly IRepository<DocumentCache> _repo;
    private readonly IUnitOfWork _uow;
    private readonly ILogger<DocumentCacheService> _logger;

    public DocumentCacheService(IRepository<DocumentCache> repo, IUnitOfWork uow, ILogger<DocumentCacheService> logger)
    {
        _repo = repo;
        _uow = uow;
        _logger = logger;
    }

    /// <summary>Check if a cache entry exists. Returns (null, false) if not found.</summary>
    public async Task<(DocumentCache? Entry, bool Exists)> CheckAsync(
        long documentNumber, string module, long tenantId, CancellationToken ct = default)
    {
        var entries = await _repo.FindAsync(
            c => c.DocumentNumber == documentNumber
              && c.Module == module
              && c.TenantId == tenantId
              && !c.IsDeleted, ct);

        var entry = entries.FirstOrDefault();
        return (entry, entry != null);
    }

    /// <summary>Save or update cache entry (upsert).</summary>
    public async Task<DocumentCache> UpsertAsync(
        long documentNumber, string module, string documentType,
        string contentJson, long tenantId, long userId,
        long? childDocumentNumber = null, string? remark = null,
        CancellationToken ct = default)
    {
        var (existing, exists) = await CheckAsync(documentNumber, module, tenantId, ct);

        if (exists && existing != null)
        {
            existing.ContentJson = contentJson;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.UpdatedByUserId = userId;
            existing.Remark = remark;
            await _uow.SaveChangesAsync(ct);
            return existing;
        }

        var entry = new DocumentCache
        {
            DocumentNumber = documentNumber,
            Module = module,
            DocumentType = documentType,
            ChildElementDocumentNumber = childDocumentNumber,
            ContentJson = contentJson,
            TenantId = tenantId,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
            Remark = remark
        };

        return await _repo.AddAsync(entry, ct);
    }

    public async Task DeleteAsync(long documentNumber, string module, long tenantId, CancellationToken ct = default)
    {
        var (entry, exists) = await CheckAsync(documentNumber, module, tenantId, ct);
        if (exists && entry != null)
        {
            entry.IsDeleted = true;
            entry.UpdatedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(ct);
        }
    }

    public async Task<DocumentCache?> GetAsync(long id, CancellationToken ct = default)
        => await _repo.GetByIdAsync(id, ct);
}
