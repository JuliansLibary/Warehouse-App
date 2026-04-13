using WarehouseApp.Domain.Enums;

namespace WarehouseApp.Domain.Entities;

/// <summary>
/// Represents a SAP Business One Service Layer connection.
/// Supports multiple instances for multi-instance deployments.
/// </summary>
public class Instance : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string SlUrl { get; set; } = string.Empty;
    public string SlPort { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;

    // OAuth / OpenID Connect for Keycloak
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;

    // SAP Service Layer Authentication mode (switchable per instance)
    public SapAuthMode AuthMode { get; set; } = SapAuthMode.Cookie;

    // Navigation
    public ICollection<Tenant> Tenants { get; set; } = new List<Tenant>();
    public ICollection<User> Users { get; set; } = new List<User>();
}
