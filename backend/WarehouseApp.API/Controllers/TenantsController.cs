using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Application.DTOs;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenantsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<TenantsController> _logger;

    public TenantsController(AppDbContext db, ILogger<TenantsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] long? instanceId, CancellationToken ct)
    {
        var query = _db.Tenants.Include(t => t.Instance).AsQueryable();
        if (instanceId.HasValue)
            query = query.Where(t => t.InstanceId == instanceId.Value);

        var tenants = await query
            .Where(t => t.IsActive)
            .Select(t => new TenantDto(t.Id, t.Name, t.CompanyDb, t.IsValidated,
                t.IsActive, t.InstanceId, t.Instance.Name, t.CreatedAt))
            .ToListAsync(ct);

        return Ok(tenants);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id, CancellationToken ct)
    {
        var tenant = await _db.Tenants.Include(t => t.Instance)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null) return NotFound();

        return Ok(new TenantDto(tenant.Id, tenant.Name, tenant.CompanyDb, tenant.IsValidated,
            tenant.IsActive, tenant.InstanceId, tenant.Instance.Name, tenant.CreatedAt));
    }

    [HttpGet("by-name/{name}")]
    public async Task<IActionResult> GetByName(string name, CancellationToken ct)
    {
        var tenant = await _db.Tenants.Include(t => t.Instance)
            .FirstOrDefaultAsync(t => t.Name == name && t.IsActive, ct);
        if (tenant == null) return NotFound();

        return Ok(new TenantDto(tenant.Id, tenant.Name, tenant.CompanyDb, tenant.IsValidated,
            tenant.IsActive, tenant.InstanceId, tenant.Instance.Name, tenant.CreatedAt));
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest request, CancellationToken ct)
    {
        var instance = await _db.Instances.FindAsync(new object[] { request.InstanceId }, ct);
        if (instance == null) return BadRequest("Instance not found");

        var tenant = new Tenant
        {
            Name = request.Name,
            CompanyDb = request.CompanyDb,
            InstanceId = request.InstanceId
        };

        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Tenant {Name} created for instance {InstanceId}", tenant.Name, tenant.InstanceId);
        return CreatedAtAction(nameof(GetById), new { id = tenant.Id },
            new TenantDto(tenant.Id, tenant.Name, tenant.CompanyDb, tenant.IsValidated,
                tenant.IsActive, tenant.InstanceId, instance.Name, tenant.CreatedAt));
    }

    [HttpPatch("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateTenantRequest request, CancellationToken ct)
    {
        var tenant = await _db.Tenants.FindAsync(new object[] { id }, ct);
        if (tenant == null) return NotFound();

        if (request.Name != null) tenant.Name = request.Name;
        if (request.CompanyDb != null) tenant.CompanyDb = request.CompanyDb;
        if (request.IsValidated.HasValue) tenant.IsValidated = request.IsValidated.Value;
        if (request.IsActive.HasValue) tenant.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var tenant = await _db.Tenants.FindAsync(new object[] { id }, ct);
        if (tenant == null) return NotFound();

        tenant.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
