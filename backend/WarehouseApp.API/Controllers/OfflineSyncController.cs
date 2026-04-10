using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WarehouseApp.Application.Services;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/offline-sync")]
[Authorize]
public class OfflineSyncController : ControllerBase
{
    private readonly OfflineSyncService _syncService;

    public OfflineSyncController(OfflineSyncService syncService) => _syncService = syncService;

    private string CurrentUserId => User.FindFirstValue("preferred_username") ?? "unknown";

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending([FromHeader(Name = "X-Tenant-Id")] long tenantId, CancellationToken ct)
    {
        var entries = await _syncService.GetPendingAsync(CurrentUserId, tenantId, ct);
        return Ok(entries);
    }

    [HttpPost("enqueue")]
    public async Task<IActionResult> Enqueue([FromBody] EnqueueRequest request,
        [FromHeader(Name = "X-Tenant-Id")] long tenantId, CancellationToken ct)
    {
        var entry = await _syncService.EnqueueAsync(
            CurrentUserId, request.Module, request.ActionType,
            request.SapEndpoint, request.PayloadJson, tenantId, ct);
        return Ok(entry);
    }

    [HttpPost("process")]
    public async Task<IActionResult> Process(
        [FromHeader(Name = "X-Instance-Id")] long instanceId,
        [FromHeader(Name = "X-Tenant-Id")] long tenantId,
        CancellationToken ct)
    {
        await _syncService.ProcessPendingAsync(CurrentUserId, instanceId, tenantId, ct);
        return Ok(new { message = "Sync completed" });
    }
}

public record EnqueueRequest(string Module, string ActionType, string SapEndpoint, string PayloadJson);
