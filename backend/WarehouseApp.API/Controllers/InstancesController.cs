using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Application.DTOs;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Domain.Interfaces;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InstancesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<InstancesController> _logger;

    public InstancesController(AppDbContext db, ILogger<InstancesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var instances = await _db.Instances
            .Include(i => i.Tenants)
            .Select(i => new InstanceDto(
                i.Id, i.Name, i.SlUrl, i.SlPort, i.BaseUrl, i.ClientId,
                i.AuthMode, i.Tenants.Count, i.CreatedAt))
            .ToListAsync(ct);

        return Ok(instances);
    }

    [HttpGet("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> GetById(long id, CancellationToken ct)
    {
        var instance = await _db.Instances
            .Include(i => i.Tenants)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

        if (instance == null) return NotFound();

        return Ok(new InstanceDto(instance.Id, instance.Name, instance.SlUrl, instance.SlPort,
            instance.BaseUrl, instance.ClientId, instance.AuthMode, instance.Tenants.Count, instance.CreatedAt));
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] CreateInstanceRequest request, CancellationToken ct)
    {
        var instance = new Instance
        {
            Name = request.Name,
            SlUrl = request.SlUrl,
            SlPort = request.SlPort,
            BaseUrl = request.BaseUrl,
            ClientId = request.ClientId,
            ClientSecret = request.ClientSecret,
            AuthMode = request.AuthMode
        };

        _db.Instances.Add(instance);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Instance {Name} created (AuthMode: {AuthMode})", instance.Name, instance.AuthMode);
        return CreatedAtAction(nameof(GetById), new { id = instance.Id },
            new InstanceDto(instance.Id, instance.Name, instance.SlUrl, instance.SlPort,
                instance.BaseUrl, instance.ClientId, instance.AuthMode, 0, instance.CreatedAt));
    }

    [HttpPatch("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateInstanceRequest request, CancellationToken ct)
    {
        var instance = await _db.Instances.FindAsync(new object[] { id }, ct);
        if (instance == null) return NotFound();

        if (request.Name != null) instance.Name = request.Name;
        if (request.SlUrl != null) instance.SlUrl = request.SlUrl;
        if (request.SlPort != null) instance.SlPort = request.SlPort;
        if (request.BaseUrl != null) instance.BaseUrl = request.BaseUrl;
        if (request.ClientId != null) instance.ClientId = request.ClientId;
        if (request.ClientSecret != null) instance.ClientSecret = request.ClientSecret;
        if (request.AuthMode.HasValue) instance.AuthMode = request.AuthMode.Value;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var instance = await _db.Instances.FindAsync(new object[] { id }, ct);
        if (instance == null) return NotFound();

        _db.Instances.Remove(instance);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
