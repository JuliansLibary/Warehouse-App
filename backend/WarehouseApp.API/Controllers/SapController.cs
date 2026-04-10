using System.Security.Claims;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Application.DTOs;
using WarehouseApp.Application.Services;
using WarehouseApp.Infrastructure.Data;
using WarehouseApp.Infrastructure.Sap;

namespace WarehouseApp.API.Controllers;

/// <summary>
/// SAP Service Layer proxy controller.
/// All warehouse modules route their SAP calls through this controller.
/// </summary>
[ApiController]
[Route("api/sap")]
[Authorize]
public class SapController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SapClientFactory _sapFactory;
    private readonly SapSessionService _sessionService;
    private readonly ILogger<SapController> _logger;

    public SapController(AppDbContext db, SapClientFactory sapFactory,
        SapSessionService sessionService, ILogger<SapController> logger)
    {
        _db = db;
        _sapFactory = sapFactory;
        _sessionService = sessionService;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue("preferred_username")
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "unknown";

    /// <summary>Login to SAP Service Layer and store session.</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] CheckSapCredentialsRequest request,
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var instance = await _db.Instances.FindAsync(new object[] { instanceId }, ct);
        if (instance == null) return BadRequest("Instance not found");

        var client = _sapFactory.Create(instance);
        var result = await client.LoginAsync(request.UserName, request.Password, request.Database, ct);

        if (!result.Success)
            return Unauthorized(new { message = result.ErrorMessage });

        // Store session for subsequent requests
        if (result.SessionToken != null)
            _sessionService.StoreSession(CurrentUserId, instanceId, result.SessionToken);

        return Ok(new { message = "Login successful", authMode = instance.AuthMode.ToString() });
    }

    /// <summary>Logout from SAP Service Layer.</summary>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var instance = await _db.Instances.FindAsync(new object[] { instanceId }, ct);
        if (instance == null) return BadRequest("Instance not found");

        var sessionToken = _sessionService.GetSession(CurrentUserId, instanceId);
        if (sessionToken != null)
        {
            var client = _sapFactory.Create(instance);
            await client.LogoutAsync(sessionToken, ct);
            _sessionService.RemoveSession(CurrentUserId, instanceId);
        }

        return Ok();
    }

    /// <summary>Check SAP credentials without storing session.</summary>
    [HttpGet("check-credentials")]
    public async Task<IActionResult> CheckCredentials(
        [FromQuery] string userName, [FromQuery] string password, [FromQuery] string database,
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var instance = await _db.Instances.FindAsync(new object[] { instanceId }, ct);
        if (instance == null) return BadRequest("Instance not found");

        var client = _sapFactory.Create(instance);
        var result = await client.LoginAsync(userName, password, database, ct);

        // Immediately logout if using Cookie mode
        if (result.Success && result.SessionToken != null)
            await client.LogoutAsync(result.SessionToken, ct);

        return Ok(new SapCredentialsCheckResult(result.Success, result.ErrorMessage));
    }

    /// <summary>Generic GET proxy to SAP Service Layer.</summary>
    [HttpGet("query")]
    public async Task<IActionResult> Query([FromQuery] string endpoint,
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var (client, sessionToken, error) = await GetClientAndSession(instanceId, ct);
        if (error != null) return StatusCode(401, error);

        var result = await client!.GetAsync<object>(endpoint, sessionToken, ct);
        if (!result.Success) return StatusCode(result.StatusCode, new { message = result.ErrorMessage });
        return Ok(result.Data);
    }

    /// <summary>Generic POST proxy to SAP Service Layer.</summary>
    [HttpPost("post")]
    public async Task<IActionResult> Post([FromQuery] string endpoint, [FromBody] object body,
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var (client, sessionToken, error) = await GetClientAndSession(instanceId, ct);
        if (error != null) return StatusCode(401, error);

        var result = await client!.PostAsync<object>(endpoint, body, sessionToken, ct);
        if (!result.Success) return StatusCode(result.StatusCode, new { message = result.ErrorMessage });
        return Ok(result.Data);
    }

    /// <summary>Generic PATCH proxy to SAP Service Layer.</summary>
    [HttpPatch("patch")]
    public async Task<IActionResult> Patch([FromQuery] string endpoint, [FromBody] object body,
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var (client, sessionToken, error) = await GetClientAndSession(instanceId, ct);
        if (error != null) return StatusCode(401, error);

        var result = await client!.PatchAsync<object>(endpoint, body, sessionToken, ct);
        if (!result.Success) return StatusCode(result.StatusCode, new { message = result.ErrorMessage });
        return result.StatusCode == 204 ? NoContent() : Ok(result.Data);
    }

    private async Task<(Domain.Interfaces.ISapServiceLayerClient? Client, string? SessionToken, object? Error)>
        GetClientAndSession(long instanceId, CancellationToken ct)
    {
        var instance = await _db.Instances.FindAsync(new object[] { instanceId }, ct);
        if (instance == null) return (null, null, new { message = "Instance not found" });

        var sessionToken = _sessionService.GetSession(CurrentUserId, instanceId);
        if (sessionToken == null)
            return (null, null, new { message = "No SAP session. Please login first." });

        return (_sapFactory.Create(instance), sessionToken, null);
    }
}
