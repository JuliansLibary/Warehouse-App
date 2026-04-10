using WarehouseApp.Domain.Enums;

namespace WarehouseApp.Application.DTOs;

public record UserDto(
    long Id,
    string IdentityId,
    string DisplayName,
    string Email,
    string? SapUsername,
    bool HasSapCredentials,
    string ThemeSetting,
    string Language,
    string? ChosenWarehouseCode,
    string? ChosenWarehouseName,
    UserRole Role,
    long InstanceId,
    DateTime CreatedAt
);

public record SaveSapCredentialsRequest(
    string SapUsername,
    string SapPassword
);

public record UpdateUserPreferencesRequest(
    string? ThemeSetting,
    string? Language,
    string? ChosenWarehouseCode,
    string? ChosenWarehouseName
);
