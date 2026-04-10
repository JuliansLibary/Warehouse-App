namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Background-saved draft state for warehouse documents.
/// Replaces the workers.js background save logic from the old app.
/// </summary>
public class DocumentCache : BaseEntity
{
    public long DocumentNumber { get; set; }
    public string Module { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public long? ChildElementDocumentNumber { get; set; }
    public string ContentJson { get; set; } = "{}";
    public string? Remark { get; set; }
    public bool IsDeleted { get; set; } = false;

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public long CreatedByUserId { get; set; }
    public long UpdatedByUserId { get; set; }
}
