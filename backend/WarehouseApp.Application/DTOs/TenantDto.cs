namespace WarehouseApp.Application.DTOs;

public record TenantDto(
    long Id,
    string Name,
    string CompanyDb,
    bool IsValidated,
    bool IsActive,
    long InstanceId,
    string InstanceName,
    DateTime CreatedAt
);

public record CreateTenantRequest(
    string Name,
    string CompanyDb,
    long InstanceId
);

public record UpdateTenantRequest(
    string? Name,
    string? CompanyDb,
    bool? IsValidated,
    bool? IsActive
);
