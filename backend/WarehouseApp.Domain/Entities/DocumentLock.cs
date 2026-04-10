namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Soft document lock to prevent concurrent edits.
/// Lock expires after configurable timeout (default 30 minutes).
/// </summary>
public class DocumentLock : BaseEntity
{
    public long DocumentNumber { get; set; }
    public long? ChildElementDocumentNumber { get; set; }
    public string Module { get; set; } = string.Empty;
    public DateTime LatestChangeDate { get; set; } = DateTime.UtcNow;

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public long LockedByUserId { get; set; }
    public string LockedByUsername { get; set; } = string.Empty;
}
