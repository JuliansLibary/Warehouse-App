namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Module configuration per tenant. Stores feature flags and operational settings.
/// </summary>
public class Configuration : BaseEntity
{
    public string Module { get; set; } = string.Empty;
    public string ConfigJson { get; set; } = "{}";
    public string Type { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public bool IsConfigurable { get; set; }
    public bool IsActive { get; set; } = false;
    public string? Icon { get; set; }

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
