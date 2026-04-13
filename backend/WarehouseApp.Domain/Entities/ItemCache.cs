namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Cached SAP item master data for offline support and performance.
/// </summary>
public class ItemCache
{
    public string ItemCode { get; set; } = string.Empty;
    public string? ItemName { get; set; }
    public string ManageSerialNumbers { get; set; } = "tNO";
    public string ManageBatchNumbers { get; set; } = "tNO";
    public string BarcodesJson { get; set; } = "[]";
    public DateTime SyncedAt { get; set; } = DateTime.UtcNow;

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
