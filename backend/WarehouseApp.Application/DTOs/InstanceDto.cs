using WarehouseApp.Domain.Enums;

namespace WarehouseApp.Application.DTOs;

public record InstanceDto(
    long Id,
    string Name,
    string SlUrl,
    string SlPort,
    string BaseUrl,
    string ClientId,
    SapAuthMode AuthMode,
    int TenantCount,
    DateTime CreatedAt
);

public record CreateInstanceRequest(
    string Name,
    string SlUrl,
    string SlPort,
    string BaseUrl,
    string ClientId,
    string ClientSecret,
    SapAuthMode AuthMode
);

public record UpdateInstanceRequest(
    string? Name,
    string? SlUrl,
    string? SlPort,
    string? BaseUrl,
    string? ClientId,
    string? ClientSecret,
    SapAuthMode? AuthMode
);
