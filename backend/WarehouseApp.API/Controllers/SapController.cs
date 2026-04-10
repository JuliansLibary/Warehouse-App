using System.Security.Claims;
using System.Text;
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
/// Supports auto-login: if no session exists, uses stored SAP credentials to login automatically.
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

    /// <summary>Explicit login to SAP Service Layer (e.g. after credentials change).</summary>
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

        if (result.Success && result.SessionToken != null)
            await client.LogoutAsync(result.SessionToken, ct);

        return Ok(new SapCredentialsCheckResult(result.Success, result.ErrorMessage));
    }

    /// <summary>Generic GET proxy to SAP Service Layer. Auto-logins if no session.</summary>
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

    /// <summary>
    /// Generic POST proxy to SAP Service Layer.
    /// Body: { "endpoint": "...", "body": {...} }
    /// </summary>
    [HttpPost("post")]
    public async Task<IActionResult> Post([FromBody] SapProxyRequest request,
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var (client, sessionToken, error) = await GetClientAndSession(instanceId, ct);
        if (error != null) return StatusCode(401, error);

        var result = await client!.PostAsync<object>(request.Endpoint, request.Body, sessionToken, ct);
        if (!result.Success) return StatusCode(result.StatusCode, new { message = result.ErrorMessage });
        return Ok(result.Data);
    }

    /// <summary>
    /// Generic PATCH proxy to SAP Service Layer.
    /// Body: { "endpoint": "...", "body": {...} }
    /// </summary>
    [HttpPost("patch")]
    public async Task<IActionResult> Patch([FromBody] SapProxyRequest request,
        [FromHeader(Name = "X-Instance-Id")] long instanceId, CancellationToken ct)
    {
        var (client, sessionToken, error) = await GetClientAndSession(instanceId, ct);
        if (error != null) return StatusCode(401, error);

        var result = await client!.PatchAsync<object>(request.Endpoint, request.Body, sessionToken, ct);
        if (!result.Success) return StatusCode(result.StatusCode, new { message = result.ErrorMessage });
        return result.StatusCode == 204 ? NoContent() : Ok(result.Data);
    }

    /// <summary>
    /// Upload a file attachment and link it to a SAP document.
    /// Used by PurchaseDelivery to attach delivery note images to GoodsReceiptsPO.
    /// </summary>
    [HttpPost("attachment")]
    [RequestSizeLimit(20 * 1024 * 1024)] // 20 MB
    public async Task<IActionResult> UploadAttachment(
        [FromForm] IFormFile file,
        [FromForm] long docEntry,
        [FromForm] string objectType,
        [FromHeader(Name = "X-Instance-Id")] long instanceId,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file provided");

        var (client, sessionToken, error) = await GetClientAndSession(instanceId, ct);
        if (error != null) return StatusCode(401, error);

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var fileBytes = ms.ToArray();

        // SAP Service Layer: POST /Attachments2 with multipart/form-data
        var result = await client!.UploadAttachmentAsync<object>(
            $"Attachments2", fileBytes, file.FileName, sessionToken, ct);

        if (!result.Success)
            return StatusCode(result.StatusCode, new { message = result.ErrorMessage });

        _logger.LogInformation("Attachment uploaded for {ObjectType} DocEntry={DocEntry}", objectType, docEntry);
        return Ok(result.Data);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Gets SAP client + session token for the current user.
    /// Auto-logins using stored credentials if no active session exists.
    /// </summary>
    private async Task<(Domain.Interfaces.ISapServiceLayerClient? Client, string? SessionToken, object? Error)>
        GetClientAndSession(long instanceId, CancellationToken ct)
    {
        var instance = await _db.Instances
            .Include(i => i.Tenants)
            .FirstOrDefaultAsync(i => i.Id == instanceId, ct);
        if (instance == null) return (null, null, new { message = "Instance not found" });

        var client = _sapFactory.Create(instance);
        var sessionToken = _sessionService.GetSession(CurrentUserId, instanceId);

        if (sessionToken == null)
        {
            // Auto-login using stored SAP credentials
            var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == CurrentUserId, ct);
            if (user?.SapUsername == null || user.SapPasswordHash == null)
                return (null, null, new { message = "No SAP credentials configured. Please set your SAP credentials in your profile." });

            // Decode the stored SAP password (Base64-encoded)
            string sapPassword;
            try { sapPassword = Encoding.UTF8.GetString(Convert.FromBase64String(user.SapPasswordHash)); }
            catch { return (null, null, new { message = "Invalid stored SAP credentials. Please update your profile." }); }

            var tenant = instance.Tenants.FirstOrDefault();
            var companyDb = tenant?.CompanyDb ?? "";

            var loginResult = await client.LoginAsync(user.SapUsername, sapPassword, companyDb, ct);
            if (!loginResult.Success)
                return (null, null, new { message = $"SAP auto-login failed: {loginResult.ErrorMessage}" });

            if (loginResult.SessionToken != null)
                _sessionService.StoreSession(CurrentUserId, instanceId, loginResult.SessionToken);

            sessionToken = loginResult.SessionToken ?? "basic-auth";
            _logger.LogInformation("SAP auto-login successful for user {UserId} on instance {InstanceId}", CurrentUserId, instanceId);
        }

        return (client, sessionToken, null);
    }
}

/// <summary>Request body for POST/PATCH SAP proxy calls.</summary>
public record SapProxyRequest(string Endpoint, object Body);
