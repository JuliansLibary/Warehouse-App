namespace WarehouseApp.Domain.Enums;

/// <summary>
/// User roles with graduated authority levels.
/// InstallationAdmin > InstanceAdmin > TenantAdmin > Admin > Supervisor > Warehouse > ReadOnly
/// </summary>
public enum UserRole
{
    /// <summary>Full system access including instance management.</summary>
    Admin = 0,

    /// <summary>Tenant-level supervision, can view all data and override locks.</summary>
    Supervisor = 1,

    /// <summary>Standard warehouse worker, can perform all warehouse operations.</summary>
    Warehouse = 2,

    /// <summary>Read-only access, cannot save/post documents.</summary>
    ReadOnly = 3,

    /// <summary>Cross-instance system administrator. Can manage all instances and tenants.</summary>
    InstallationAdmin = 10,

    /// <summary>Instance-scoped administrator. Can manage tenants and users within their instance.</summary>
    InstanceAdmin = 11,

    /// <summary>Tenant-scoped administrator. Can manage users and configurations within their tenant.</summary>
    TenantAdmin = 12,
}
