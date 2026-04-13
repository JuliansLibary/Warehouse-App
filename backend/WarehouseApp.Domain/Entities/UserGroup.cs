namespace WarehouseApp.Domain.Entities;

/// <summary>
/// A named permission group within a tenant (e.g., "Buchhaltung", "Lager-Team").
/// Groups define module-level permissions that override individual user roles for finer granularity.
/// </summary>
public class UserGroup : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    // Navigation
    public ICollection<UserGroupMembership> Memberships { get; set; } = new List<UserGroupMembership>();
    public ICollection<GroupModulePermission> ModulePermissions { get; set; } = new List<GroupModulePermission>();
}

/// <summary>
/// Membership linking a user to a group.
/// </summary>
public class UserGroupMembership
{
    public long GroupId { get; set; }
    public UserGroup Group { get; set; } = null!;

    public long UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Module-level permission entry for a group.
/// Defines what actions the group members can perform in a specific module.
/// </summary>
public class GroupModulePermission
{
    public long Id { get; set; }
    public long GroupId { get; set; }
    public UserGroup Group { get; set; } = null!;

    /// <summary>Module name matching nav route, e.g. "Pick", "Pack", "PurchaseDelivery".</summary>
    public string Module { get; set; } = string.Empty;

    /// <summary>Group members can view / open the module.</summary>
    public bool CanView { get; set; } = true;

    /// <summary>Group members can edit / scan / enter quantities.</summary>
    public bool CanEdit { get; set; } = true;

    /// <summary>Group members can post / book documents to SAP.</summary>
    public bool CanBook { get; set; } = false;
}
