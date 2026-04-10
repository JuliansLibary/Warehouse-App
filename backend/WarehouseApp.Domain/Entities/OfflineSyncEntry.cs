namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Pending offline actions waiting to be synced with SAP.
/// Created when the app was offline; processed when back online.
/// </summary>
public class OfflineSyncEntry : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty; // POST, PATCH, etc.
    public string SapEndpoint { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "Pending"; // Pending, Processing, Done, Failed
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; } = 0;
    public DateTime? ProcessedAt { get; set; }

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
