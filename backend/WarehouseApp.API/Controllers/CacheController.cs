using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WarehouseApp.Application.Services;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CacheController : ControllerBase
{
    private readonly DocumentCacheService _cacheService;
    private readonly AppDbContext _db;
    private readonly ILogger<CacheController> _logger;

    public CacheController(DocumentCacheService cacheService, AppDbContext db, ILogger<CacheController> logger)
    {
        _cacheService = cacheService;
        _db = db;
        _logger = logger;
    }

    private long CurrentUserId
    {
        get
        {
            var identityId = User.FindFirstValue("preferred_username") ?? "";
            var user = _db.Users.FirstOrDefault(u => u.IdentityId == identityId);
            return user?.Id ?? 0;
        }
    }

    [HttpGet("check/{documentNumber:long}/{module}/{tenantId:long}")]
    public async Task<IActionResult> Check(long documentNumber, string module, long tenantId, CancellationToken ct)
    {
        var (entry, exists) = await _cacheService.CheckAsync(documentNumber, module, tenantId, ct);
        if (!exists) return StatusCode(209, new { message = "Not found" }); // 209 matches old app behavior
        return Ok(entry);
    }

    [HttpPost("save")]
    public async Task<IActionResult> Save([FromBody] SaveCacheRequest request, CancellationToken ct)
    {
        var userId = CurrentUserId;
        var entry = await _cacheService.UpsertAsync(
            request.DocumentNumber, request.Module, request.DocumentType,
            request.ContentJson, request.TenantId, userId,
            request.ChildDocumentNumber, request.Remark, ct);

        return Ok(entry);
    }

    [HttpPatch("{id:long}")]
    public async Task<IActionResult> Patch(long id, [FromBody] PatchCacheRequest request, CancellationToken ct)
    {
        var entry = await _cacheService.GetAsync(id, ct);
        if (entry == null) return NotFound();

        entry.ContentJson = request.ContentJson;
        entry.UpdatedAt = DateTime.UtcNow;
        entry.UpdatedByUserId = CurrentUserId;

        await _db.SaveChangesAsync(ct);
        return Ok(entry);
    }

    [HttpDelete("{documentNumber:long}/{module}/{tenantId:long}")]
    public async Task<IActionResult> Delete(long documentNumber, string module, long tenantId, CancellationToken ct)
    {
        await _cacheService.DeleteAsync(documentNumber, module, tenantId, ct);
        return NoContent();
    }
}

public record SaveCacheRequest(
    long DocumentNumber, string Module, string DocumentType,
    string ContentJson, long TenantId,
    long? ChildDocumentNumber = null, string? Remark = null);

public record PatchCacheRequest(string ContentJson);
