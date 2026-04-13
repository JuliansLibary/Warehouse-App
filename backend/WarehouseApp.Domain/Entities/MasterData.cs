namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Cached SAP master data (Warehouses, BusinessPartners, etc.)
/// </summary>
public class MasterData
{
    public string DataType { get; set; } = string.Empty;
    public string? Module { get; set; }
    public string ContentJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
