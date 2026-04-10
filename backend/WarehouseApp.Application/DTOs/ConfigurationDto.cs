namespace WarehouseApp.Application.DTOs;

public record ConfigurationDto(
    long Id,
    string Module,
    string ConfigJson,
    string Type,
    string Route,
    bool IsConfigurable,
    bool IsActive,
    string? Icon,
    long TenantId,
    DateTime UpdatedAt
);

public record SaveConfigurationRequest(
    string Module,
    string ConfigJson,
    string Type,
    string Route,
    bool IsConfigurable,
    bool IsActive,
    string? Icon,
    long TenantId
);
