using System.Security.Claims;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Application.DTOs;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Domain.Enums;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<UsersController> _logger;

    public UsersController(AppDbContext db, ILogger<UsersController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue("preferred_username")
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException("User identity not found");

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser(CancellationToken ct)
    {
        var identityId = CurrentUserId;
        var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == identityId, ct);

        if (user == null)
        {
            // Auto-provision user on first access
            var instanceId = await _db.Instances.Select(i => i.Id).FirstOrDefaultAsync(ct);
            user = new User
            {
                IdentityId = identityId,
                DisplayName = User.FindFirstValue("name") ?? identityId,
                Email = User.FindFirstValue(ClaimTypes.Email) ?? "",
                InstanceId = instanceId,
                Role = UserRole.Warehouse
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Auto-provisioned user {IdentityId}", identityId);
        }

        return Ok(ToDto(user));
    }

    [HttpGet("{identityId}")]
    public async Task<IActionResult> GetByIdentityId(string identityId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == identityId, ct);
        if (user == null) return NotFound();
        return Ok(ToDto(user));
    }

    [HttpPatch("me/preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] UpdateUserPreferencesRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == CurrentUserId, ct);
        if (user == null) return NotFound();

        if (request.ThemeSetting != null) user.ThemeSetting = request.ThemeSetting;
        if (request.Language != null) user.Language = request.Language;
        if (request.ChosenWarehouseCode != null) user.ChosenWarehouseCode = request.ChosenWarehouseCode;
        if (request.ChosenWarehouseName != null) user.ChosenWarehouseName = request.ChosenWarehouseName;

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(user));
    }

    [HttpPost("me/sap-credentials")]
    public async Task<IActionResult> SaveSapCredentials([FromBody] SaveSapCredentialsRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == CurrentUserId, ct);
        if (user == null) return NotFound();

        user.SapUsername = request.SapUsername;
        user.SapPasswordHash = BCrypt.Net.BCrypt.HashPassword(request.SapPassword);

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("SAP credentials updated for user {IdentityId}", CurrentUserId);
        return NoContent();
    }

    [HttpPost("me/profile-picture")]
    public async Task<IActionResult> UploadProfilePicture(IFormFile file, CancellationToken ct)
    {
        if (file.Length > 5 * 1024 * 1024) return BadRequest("File too large (max 5MB)");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == CurrentUserId, ct);
        if (user == null) return NotFound();

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        user.ProfilePicture = ms.ToArray();

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var users = await _db.Users.Select(u => ToDto(u)).ToListAsync(ct);
        return Ok(users);
    }

    [HttpPatch("{id:long}/role")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateRole(long id, [FromBody] UserRole role, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync(new object[] { id }, ct);
        if (user == null) return NotFound();

        user.Role = role;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static UserDto ToDto(User u) => new(
        u.Id, u.IdentityId, u.DisplayName, u.Email,
        u.SapUsername, u.SapPasswordHash != null,
        u.ThemeSetting, u.Language,
        u.ChosenWarehouseCode, u.ChosenWarehouseName,
        u.Role, u.InstanceId, u.CreatedAt);
}
