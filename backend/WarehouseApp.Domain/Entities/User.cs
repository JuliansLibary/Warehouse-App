using WarehouseApp.Domain.Enums;

namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Application user. Links identity (Keycloak) to SAP B1 credentials.
/// </summary>
public class User : BaseEntity
{
    public string IdentityId { get; set; } = string.Empty;      // Keycloak preferred_username
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    // SAP B1 credentials (stored encrypted)
    public string? SapUsername { get; set; }
    public string? SapPasswordHash { get; set; }

    // User preferences
    public string ThemeSetting { get; set; } = "sap_fiori_3";
    public string Language { get; set; } = "en";
    public byte[]? ProfilePicture { get; set; }
    public string? ChosenWarehouseCode { get; set; }
    public string? ChosenWarehouseName { get; set; }

    // Role-based access
    public UserRole Role { get; set; } = UserRole.Warehouse;

    // FK
    public long InstanceId { get; set; }
    public Instance Instance { get; set; } = null!;
}
