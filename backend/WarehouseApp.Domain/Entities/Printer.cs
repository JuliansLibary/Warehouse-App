namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Label printer configuration per tenant.
/// </summary>
public class Printer : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsDefault { get; set; } = false;

    // FK
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
}
