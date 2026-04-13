namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Extended details for posted documents (method-specific data).
/// </summary>
public class DocumentDetails
{
    public string DocEntry { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string? DocumentType { get; set; }
    public string ContentJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
