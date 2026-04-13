using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

/// <summary>
/// Dynamic RBAC group management.
/// Groups define fine-grained module permissions (view/edit/book) per tenant.
/// Examples: "Buchhaltung" → can view Pick but cannot book; "Lager-Team" → full access.
/// </summary>
[ApiController]
[Route("api/groups")]
[Authorize]
public class GroupsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<GroupsController> _logger;

    public GroupsController(AppDbContext db, ILogger<GroupsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue("preferred_username")
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "unknown";

    // ─── Groups CRUD ──────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        CancellationToken ct)
    {
        var groups = await _db.UserGroups
            .Where(g => g.TenantId == tenantId)
            .Include(g => g.Memberships).ThenInclude(m => m.User)
            .Include(g => g.ModulePermissions)
            .OrderBy(g => g.Name)
            .ToListAsync(ct);

        return Ok(groups.Select(g => new GroupDto(
            g.Id, g.Name, g.Description,
            g.Memberships.Select(m => new GroupMemberDto(m.UserId, m.User.DisplayName, m.User.Email)).ToList(),
            g.ModulePermissions.Select(p => new ModulePermissionDto(p.Id, p.Module, p.CanView, p.CanEdit, p.CanBook)).ToList()
        )));
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id, CancellationToken ct)
    {
        var group = await _db.UserGroups
            .Include(g => g.Memberships).ThenInclude(m => m.User)
            .Include(g => g.ModulePermissions)
            .FirstOrDefaultAsync(g => g.Id == id, ct);

        if (group == null) return NotFound();

        return Ok(new GroupDto(
            group.Id, group.Name, group.Description,
            group.Memberships.Select(m => new GroupMemberDto(m.UserId, m.User.DisplayName, m.User.Email)).ToList(),
            group.ModulePermissions.Select(p => new ModulePermissionDto(p.Id, p.Module, p.CanView, p.CanEdit, p.CanBook)).ToList()
        ));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateGroupRequest request,
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Group name is required");

        var group = new UserGroup
        {
            Name = request.Name.Trim(),
            Description = request.Description,
            TenantId = tenantId,
        };

        _db.UserGroups.Add(group);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Group '{Name}' created for tenant {TenantId} by {User}", group.Name, tenantId, CurrentUserId);
        return Created($"/api/groups/{group.Id}", new GroupDto(group.Id, group.Name, group.Description, [], []));
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateGroupRequest request, CancellationToken ct)
    {
        var group = await _db.UserGroups.FindAsync(new object[] { id }, ct);
        if (group == null) return NotFound();

        group.Name = request.Name.Trim();
        group.Description = request.Description;
        await _db.SaveChangesAsync(ct);

        return Ok();
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var group = await _db.UserGroups.FindAsync(new object[] { id }, ct);
        if (group == null) return NotFound();

        _db.UserGroups.Remove(group);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // ─── Membership management ────────────────────────────────────────────────

    [HttpPost("{id:long}/members")]
    public async Task<IActionResult> AddMember(long id, [FromBody] AddMemberRequest request, CancellationToken ct)
    {
        var group = await _db.UserGroups.FindAsync(new object[] { id }, ct);
        if (group == null) return NotFound("Group not found");

        var user = await _db.Users.FindAsync(new object[] { request.UserId }, ct);
        if (user == null) return NotFound("User not found");

        var existing = await _db.UserGroupMemberships
            .FirstOrDefaultAsync(m => m.GroupId == id && m.UserId == request.UserId, ct);
        if (existing != null) return Conflict("User is already a member");

        _db.UserGroupMemberships.Add(new UserGroupMembership
        {
            GroupId = id,
            UserId = request.UserId,
            JoinedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        return Ok();
    }

    [HttpDelete("{id:long}/members/{userId:long}")]
    public async Task<IActionResult> RemoveMember(long id, long userId, CancellationToken ct)
    {
        var membership = await _db.UserGroupMemberships
            .FirstOrDefaultAsync(m => m.GroupId == id && m.UserId == userId, ct);
        if (membership == null) return NotFound();

        _db.UserGroupMemberships.Remove(membership);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // ─── Module permissions management ───────────────────────────────────────

    [HttpPut("{id:long}/permissions")]
    public async Task<IActionResult> SetPermissions(long id, [FromBody] List<SetPermissionRequest> permissions, CancellationToken ct)
    {
        var group = await _db.UserGroups
            .Include(g => g.ModulePermissions)
            .FirstOrDefaultAsync(g => g.Id == id, ct);
        if (group == null) return NotFound();

        // Remove existing and replace with new set
        _db.GroupModulePermissions.RemoveRange(group.ModulePermissions);

        foreach (var perm in permissions)
        {
            group.ModulePermissions.Add(new GroupModulePermission
            {
                GroupId = id,
                Module = perm.Module,
                CanView = perm.CanView,
                CanEdit = perm.CanEdit,
                CanBook = perm.CanBook,
            });
        }

        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    // ─── Permission check endpoint (used by frontend) ─────────────────────────

    /// <summary>
    /// Returns effective permissions for the current user in a specific module.
    /// Aggregates permissions from all groups the user belongs to.
    /// Admin/Supervisor roles always get full access.
    /// </summary>
    [HttpGet("my-permissions/{module}")]
    public async Task<IActionResult> GetMyPermissions(
        string module,
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == CurrentUserId, ct);
        if (user == null) return NotFound("User not found");

        // Admin/Supervisor: full access always
        if (user.Role is Domain.Enums.UserRole.Admin or Domain.Enums.UserRole.Supervisor or Domain.Enums.UserRole.InstallationAdmin or Domain.Enums.UserRole.InstanceAdmin or Domain.Enums.UserRole.TenantAdmin)
            return Ok(new PermissionResult(true, true, true));

        // ReadOnly: view only
        if (user.Role == Domain.Enums.UserRole.ReadOnly)
            return Ok(new PermissionResult(true, false, false));

        // Check group-based permissions
        var groupPermissions = await _db.UserGroupMemberships
            .Where(m => m.UserId == user.Id)
            .Join(_db.GroupModulePermissions,
                m => m.GroupId,
                p => p.GroupId,
                (m, p) => p)
            .Where(p => p.Module == module || p.Module == "*")
            .ToListAsync(ct);

        if (!groupPermissions.Any())
        {
            // Default for Warehouse role: full access if no explicit restrictions
            var defaultCanBook = user.Role == Domain.Enums.UserRole.Warehouse;
            return Ok(new PermissionResult(true, defaultCanBook, defaultCanBook));
        }

        // Aggregate: if ANY group grants a permission, it's allowed
        return Ok(new PermissionResult(
            groupPermissions.Any(p => p.CanView),
            groupPermissions.Any(p => p.CanEdit),
            groupPermissions.Any(p => p.CanBook)
        ));
    }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

public record GroupDto(
    long Id, string Name, string? Description,
    List<GroupMemberDto> Members,
    List<ModulePermissionDto> ModulePermissions);

public record GroupMemberDto(long UserId, string DisplayName, string Email);

public record ModulePermissionDto(long Id, string Module, bool CanView, bool CanEdit, bool CanBook);

public record PermissionResult(bool CanView, bool CanEdit, bool CanBook);

public record CreateGroupRequest(string Name, string? Description);

public record UpdateGroupRequest(string Name, string? Description);

public record AddMemberRequest(long UserId);

public record SetPermissionRequest(string Module, bool CanView, bool CanEdit, bool CanBook);
