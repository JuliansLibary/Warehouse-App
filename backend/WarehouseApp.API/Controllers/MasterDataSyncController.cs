using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Application.Services;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Infrastructure.Data;
using WarehouseApp.Infrastructure.Sap;

namespace WarehouseApp.API.Controllers;

/// <summary>
/// Synchronises SAP Business One master data into the PostgreSQL cache.
/// Each sync replaces the entire JSON blob for (DataType, TenantId).
/// </summary>
[ApiController]
[Route("api/masterdata")]
[Authorize]
public class MasterDataSyncController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SapClientFactory _sapFactory;
    private readonly SapSessionService _sessionService;
    private readonly ILogger<MasterDataSyncController> _logger;

    public MasterDataSyncController(AppDbContext db, SapClientFactory sapFactory,
        SapSessionService sessionService, ILogger<MasterDataSyncController> logger)
    {
        _db = db;
        _sapFactory = sapFactory;
        _sessionService = sessionService;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue("preferred_username")
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? "unknown";

    // ── GET cached data ───────────────────────────────────────────────────────

    [HttpGet("{dataType}")]
    public async Task<IActionResult> GetCached(string dataType,
        [FromQuery] long tenantId, CancellationToken ct)
    {
        var record = await _db.MasterData
            .FirstOrDefaultAsync(m => m.DataType == dataType && m.TenantId == tenantId, ct);

        if (record == null)
            return Ok(new { dataType, tenantId, items = Array.Empty<object>(), syncedAt = (DateTime?)null });

        return Ok(new { dataType, tenantId, items = JsonSerializer.Deserialize<object>(record.ContentJson), syncedAt = record.UpdatedAt });
    }

    // ── Sync endpoints ────────────────────────────────────────────────────────

    /// <summary>Sync all master data types in sequence.</summary>
    [HttpPost("sync/all")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SyncAll(
        [FromQuery] long tenantId,
        [FromHeader(Name = "X-Instance-Id")] long instanceId,
        CancellationToken ct)
    {
        var results = new Dictionary<string, string>();
        foreach (var dataType in new[] { "Item", "Warehouse", "BusinessPartner" })
        {
            var (ok, msg) = await SyncDataType(dataType, tenantId, instanceId, ct);
            results[dataType] = ok ? "OK" : msg;
        }
        return Ok(results);
    }

    /// <summary>Sync Items (ItemCode, ItemName, serial/batch flags, barcodes).</summary>
    [HttpPost("sync/items")]
    public async Task<IActionResult> SyncItems(
        [FromQuery] long tenantId,
        [FromHeader(Name = "X-Instance-Id")] long instanceId,
        CancellationToken ct)
    {
        var (ok, msg) = await SyncDataType("Item", tenantId, instanceId, ct);
        return ok ? Ok(new { message = msg }) : StatusCode(500, new { message = msg });
    }

    /// <summary>Sync Warehouses (WarehouseCode, WarehouseName).</summary>
    [HttpPost("sync/warehouses")]
    public async Task<IActionResult> SyncWarehouses(
        [FromQuery] long tenantId,
        [FromHeader(Name = "X-Instance-Id")] long instanceId,
        CancellationToken ct)
    {
        var (ok, msg) = await SyncDataType("Warehouse", tenantId, instanceId, ct);
        return ok ? Ok(new { message = msg }) : StatusCode(500, new { message = msg });
    }

    /// <summary>Sync BusinessPartners (CardCode, CardName, CardType).</summary>
    [HttpPost("sync/businesspartners")]
    public async Task<IActionResult> SyncBusinessPartners(
        [FromQuery] long tenantId,
        [FromHeader(Name = "X-Instance-Id")] long instanceId,
        CancellationToken ct)
    {
        var (ok, msg) = await SyncDataType("BusinessPartner", tenantId, instanceId, ct);
        return ok ? Ok(new { message = msg }) : StatusCode(500, new { message = msg });
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private static readonly Dictionary<string, string> _sapEndpoints = new()
    {
        ["Item"]            = "Items?$select=ItemCode,ItemName,ManSerialNumbers,ManBatchNum,BarCodes&$top=5000",
        ["Warehouse"]       = "Warehouses?$select=WarehouseCode,WarehouseName,DefaultBin",
        ["BusinessPartner"] = "BusinessPartners?$select=CardCode,CardName,CardType&$top=5000"
    };

    private async Task<(bool Ok, string Message)> SyncDataType(
        string dataType, long tenantId, long instanceId, CancellationToken ct)
    {
        if (!_sapEndpoints.TryGetValue(dataType, out var endpoint))
            return (false, $"Unknown data type: {dataType}");

        var (client, sessionToken, authError) = await GetClientAndSession(instanceId, ct);
        if (authError != null)
            return (false, authError.ToString() ?? "Auth error");

        var result = await client!.GetAsync<object>(endpoint, sessionToken, ct);
        if (!result.Success)
            return (false, result.ErrorMessage ?? "SAP call failed");

        var contentJson = JsonSerializer.Serialize(result.Data);

        var existing = await _db.MasterData
            .FirstOrDefaultAsync(m => m.DataType == dataType && m.TenantId == tenantId, ct);

        if (existing != null)
        {
            existing.ContentJson = contentJson;
            existing.UpdatedAt   = DateTime.UtcNow;
        }
        else
        {
            _db.MasterData.Add(new MasterData
            {
                DataType    = dataType,
                ContentJson = contentJson,
                TenantId    = tenantId,
                CreatedAt   = DateTime.UtcNow,
                UpdatedAt   = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("MasterData sync completed: {DataType} for tenant {TenantId}", dataType, tenantId);
        return (true, $"{dataType} synced successfully");
    }

    /// <summary>
    /// Gets SAP client + session for current user, auto-logging in with stored credentials.
    /// </summary>
    private async Task<(Domain.Interfaces.ISapServiceLayerClient? Client, string? SessionToken, object? Error)>
        GetClientAndSession(long instanceId, CancellationToken ct)
    {
        var instance = await _db.Instances
            .Include(i => i.Tenants)
            .FirstOrDefaultAsync(i => i.Id == instanceId, ct);
        if (instance == null) return (null, null, "Instance not found");

        var client = _sapFactory.Create(instance);
        var sessionToken = _sessionService.GetSession(CurrentUserId, instanceId);

        if (sessionToken == null)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.IdentityId == CurrentUserId, ct);
            if (user?.SapUsername == null || user.SapPasswordHash == null)
                return (null, null, "No SAP credentials configured. Please set your SAP credentials.");

            string sapPassword;
            try { sapPassword = Encoding.UTF8.GetString(Convert.FromBase64String(user.SapPasswordHash)); }
            catch { return (null, null, "Invalid stored SAP credentials. Please update your profile."); }

            var tenant = instance.Tenants.FirstOrDefault();
            var companyDb = tenant?.CompanyDb ?? "";

            var loginResult = await client.LoginAsync(user.SapUsername, sapPassword, companyDb, ct);
            if (!loginResult.Success)
                return (null, null, $"SAP auto-login failed: {loginResult.ErrorMessage}");

            if (loginResult.SessionToken != null)
                _sessionService.StoreSession(CurrentUserId, instanceId, loginResult.SessionToken);

            sessionToken = loginResult.SessionToken ?? "basic-auth";
        }

        return (client, sessionToken, null);
    }
}
