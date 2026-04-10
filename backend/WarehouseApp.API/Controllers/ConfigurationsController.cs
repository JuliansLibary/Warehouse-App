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
public class ConfigurationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<ConfigurationsController> _logger;

    public ConfigurationsController(AppDbContext db, ILogger<ConfigurationsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] long? tenantId, [FromQuery] string? module, CancellationToken ct)
    {
        var query = _db.Configurations.AsQueryable();
        if (tenantId.HasValue) query = query.Where(c => c.TenantId == tenantId.Value);
        if (!string.IsNullOrEmpty(module)) query = query.Where(c => c.Module == module);

        var configs = await query
            .Select(c => ToDto(c))
            .ToListAsync(ct);

        return Ok(configs);
    }

    [HttpGet("{tenantId:long}/{module}")]
    public async Task<IActionResult> GetByTenantAndModule(long tenantId, string module, CancellationToken ct)
    {
        var config = await _db.Configurations
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Module == module, ct);

        if (config == null) return NotFound();
        return Ok(ToDto(config));
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Save([FromBody] SaveConfigurationRequest request, CancellationToken ct)
    {
        var existing = await _db.Configurations
            .FirstOrDefaultAsync(c => c.TenantId == request.TenantId && c.Module == request.Module, ct);

        if (existing != null)
        {
            existing.ConfigJson = request.ConfigJson;
            existing.IsActive = request.IsActive;
            existing.Icon = request.Icon;
            await _db.SaveChangesAsync(ct);
            return Ok(ToDto(existing));
        }

        var config = new Configuration
        {
            Module = request.Module,
            ConfigJson = request.ConfigJson,
            Type = request.Type,
            Route = request.Route,
            IsConfigurable = request.IsConfigurable,
            IsActive = request.IsActive,
            Icon = request.Icon,
            TenantId = request.TenantId
        };

        _db.Configurations.Add(config);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetByTenantAndModule),
            new { tenantId = config.TenantId, module = config.Module }, ToDto(config));
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var config = await _db.Configurations.FindAsync(new object[] { id }, ct);
        if (config == null) return NotFound();

        _db.Configurations.Remove(config);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static ConfigurationDto ToDto(Configuration c) => new(
        c.Id, c.Module, c.ConfigJson, c.Type, c.Route,
        c.IsConfigurable, c.IsActive, c.Icon, c.TenantId, c.UpdatedAt);
}
