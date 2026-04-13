namespace WarehouseApp.Domain.Entities;

/// <summary>
/// HTML label template for the label generator module.
/// </summary>
public class LabelTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string TemplateType { get; set; } = string.Empty; // NVE, QR, Standard, Warehouse
    public string HtmlContent { get; set; } = string.Empty;
    public bool IsDefault { get; set; } = false;

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
