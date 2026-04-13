namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Represents a SAP Business One company database (tenant).
/// Multiple tenants can share one Service Layer instance.
/// </summary>
public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string CompanyDb { get; set; } = string.Empty;
    public bool IsValidated { get; set; }
    public bool IsActive { get; set; } = true;

    // FK
    public long InstanceId { get; set; }
    public Instance Instance { get; set; } = null!;

    // Navigation
    public ICollection<Configuration> Configurations { get; set; } = new List<Configuration>();
    public ICollection<DocumentCache> Caches { get; set; } = new List<DocumentCache>();
    public ICollection<DocumentLock> DocumentLocks { get; set; } = new List<DocumentLock>();
    public ICollection<DocumentDetails> DocumentDetails { get; set; } = new List<DocumentDetails>();
    public ICollection<ItemCache> Items { get; set; } = new List<ItemCache>();
    public ICollection<MasterData> MasterData { get; set; } = new List<MasterData>();
    public ICollection<Printer> Printers { get; set; } = new List<Printer>();
}
