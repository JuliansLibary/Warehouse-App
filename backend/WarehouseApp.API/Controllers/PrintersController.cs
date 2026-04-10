using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PrintersController : ControllerBase
{
    private readonly AppDbContext _db;

    public PrintersController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] long tenantId, CancellationToken ct)
    {
        var printers = await _db.Printers
            .Where(p => p.TenantId == tenantId)
            .ToListAsync(ct);
        return Ok(printers);
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] CreatePrinterRequest request, CancellationToken ct)
    {
        var printer = new Printer
        {
            Name = request.Name,
            Url = request.Url,
            Description = request.Description,
            IsDefault = request.IsDefault,
            TenantId = request.TenantId
        };
        _db.Printers.Add(printer);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetAll), new { tenantId = printer.TenantId }, printer);
    }

    [HttpPatch("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(long id, [FromBody] CreatePrinterRequest request, CancellationToken ct)
    {
        var printer = await _db.Printers.FindAsync(new object[] { id }, ct);
        if (printer == null) return NotFound();

        printer.Name = request.Name;
        printer.Url = request.Url;
        printer.Description = request.Description;
        printer.IsDefault = request.IsDefault;

        await _db.SaveChangesAsync(ct);
        return Ok(printer);
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var printer = await _db.Printers.FindAsync(new object[] { id }, ct);
        if (printer == null) return NotFound();

        _db.Printers.Remove(printer);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record CreatePrinterRequest(string Name, string Url, string? Description, bool IsDefault, long TenantId);
