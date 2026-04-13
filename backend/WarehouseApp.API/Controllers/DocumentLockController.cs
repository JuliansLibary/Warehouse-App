using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Application.Services;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/document-lock")]
[Authorize]
public class DocumentLockController : ControllerBase
{
    private readonly DocumentLockService _lockService;
    private readonly AppDbContext _db;

    public DocumentLockController(DocumentLockService lockService, AppDbContext db)
    {
        _lockService = lockService;
        _db = db;
    }

    private string CurrentUsername => User.FindFirstValue("preferred_username") ?? "unknown";

    private async Task<long> GetUserIdAsync()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == CurrentUsername);
        return user?.Id ?? 0;
    }

    [HttpGet("check/{documentNumber:long}/{module}/{tenantId:long}")]
    public async Task<IActionResult> Check(long documentNumber, string module, long tenantId,
        [FromQuery] int timeoutMinutes = 30, CancellationToken ct = default)
    {
        var (isLocked, lockedBy) = await _lockService.CheckLockAsync(
            documentNumber, module, tenantId, timeoutMinutes, ct);

        return Ok(new { isLocked, lockedBy });
    }

    [HttpPost("acquire/{documentNumber:long}/{module}/{tenantId:long}")]
    public async Task<IActionResult> Acquire(long documentNumber, string module, long tenantId, CancellationToken ct)
    {
        var userId = await GetUserIdAsync();
        var acquired = await _lockService.AcquireLockAsync(
            documentNumber, module, tenantId, userId, CurrentUsername, ct);

        if (!acquired) return Conflict(new { message = "Document is locked by another user" });
        return Ok(new { acquired = true });
    }

    [HttpPatch("refresh/{documentNumber:long}/{module}/{tenantId:long}")]
    public async Task<IActionResult> Refresh(long documentNumber, string module, long tenantId, CancellationToken ct)
    {
        await _lockService.RefreshLockAsync(documentNumber, module, tenantId, ct);
        return NoContent();
    }

    [HttpDelete("release/{documentNumber:long}/{module}/{tenantId:long}")]
    public async Task<IActionResult> Release(long documentNumber, string module, long tenantId, CancellationToken ct)
    {
        await _lockService.ReleaseLockAsync(documentNumber, module, tenantId, ct);
        return NoContent();
    }
}
