using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Infrastructure.Data;

namespace WarehouseApp.API.Controllers;

[ApiController]
[Route("api/label-templates")]
[Authorize]
public class LabelTemplatesController : ControllerBase
{
    private readonly AppDbContext _db;

    public LabelTemplatesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] long tenantId, CancellationToken ct)
    {
        var templates = await _db.LabelTemplates
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.TemplateType).ThenBy(t => t.Name)
            .Select(t => new LabelTemplateDto(t.Id, t.Name, t.TemplateType, t.IsDefault, t.TenantId, t.UpdatedAt))
            .ToListAsync(ct);
        return Ok(templates);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id, CancellationToken ct)
    {
        var t = await _db.LabelTemplates.FindAsync(new object[] { id }, ct);
        if (t == null) return NotFound();
        return Ok(new LabelTemplateDetailDto(t.Id, t.Name, t.TemplateType, t.HtmlContent, t.IsDefault, t.TenantId, t.UpdatedAt));
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] SaveLabelTemplateRequest req, CancellationToken ct)
    {
        var template = new LabelTemplate
        {
            Name        = req.Name,
            TemplateType = req.TemplateType,
            HtmlContent = req.HtmlContent,
            IsDefault   = req.IsDefault,
            TenantId    = req.TenantId
        };

        if (req.IsDefault)
            await ClearDefaultsAsync(req.TenantId, req.TemplateType, null, ct);

        _db.LabelTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = template.Id },
            new LabelTemplateDto(template.Id, template.Name, template.TemplateType, template.IsDefault, template.TenantId, template.UpdatedAt));
    }

    [HttpPut("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(long id, [FromBody] SaveLabelTemplateRequest req, CancellationToken ct)
    {
        var template = await _db.LabelTemplates.FindAsync(new object[] { id }, ct);
        if (template == null) return NotFound();

        template.Name        = req.Name;
        template.TemplateType = req.TemplateType;
        template.HtmlContent = req.HtmlContent;
        template.IsDefault   = req.IsDefault;

        if (req.IsDefault)
            await ClearDefaultsAsync(req.TenantId, req.TemplateType, id, ct);

        await _db.SaveChangesAsync(ct);
        return Ok(new LabelTemplateDto(template.Id, template.Name, template.TemplateType, template.IsDefault, template.TenantId, template.UpdatedAt));
    }

    [HttpPost("{id:long}/set-default")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetDefault(long id, CancellationToken ct)
    {
        var template = await _db.LabelTemplates.FindAsync(new object[] { id }, ct);
        if (template == null) return NotFound();

        await ClearDefaultsAsync(template.TenantId, template.TemplateType, id, ct);
        template.IsDefault = true;
        await _db.SaveChangesAsync(ct);
        return Ok(new LabelTemplateDto(template.Id, template.Name, template.TemplateType, template.IsDefault, template.TenantId, template.UpdatedAt));
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var template = await _db.LabelTemplates.FindAsync(new object[] { id }, ct);
        if (template == null) return NotFound();

        _db.LabelTemplates.Remove(template);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async Task ClearDefaultsAsync(long tenantId, string templateType, long? exceptId, CancellationToken ct)
    {
        var others = await _db.LabelTemplates
            .Where(t => t.TenantId == tenantId && t.TemplateType == templateType && t.IsDefault
                        && (exceptId == null || t.Id != exceptId))
            .ToListAsync(ct);
        foreach (var t in others) t.IsDefault = false;
    }
}

public record LabelTemplateDto(long Id, string Name, string TemplateType, bool IsDefault, long TenantId, DateTime UpdatedAt);
public record LabelTemplateDetailDto(long Id, string Name, string TemplateType, string HtmlContent, bool IsDefault, long TenantId, DateTime UpdatedAt);
public record SaveLabelTemplateRequest(string Name, string TemplateType, string HtmlContent, bool IsDefault, long TenantId);
