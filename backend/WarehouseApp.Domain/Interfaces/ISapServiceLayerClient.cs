namespace WarehouseApp.Domain.Interfaces;

/// <summary>
/// Abstraction over SAP Business One Service Layer HTTP API.
/// Supports switchable auth: BasicAuth (stateless) and Cookie (session-based).
/// </summary>
public interface ISapServiceLayerClient
{
    /// <summary>Login and obtain session. For Cookie mode: stores B1SESSION. For Basic: no-op (credentials embedded per-request).</summary>
    Task<SapLoginResult> LoginAsync(string username, string password, string companyDb, CancellationToken ct = default);

    Task LogoutAsync(string? sessionToken = null, CancellationToken ct = default);

    Task<SapResponse<T>> GetAsync<T>(string endpoint, string? sessionToken = null, CancellationToken ct = default);

    Task<SapResponse<T>> PostAsync<T>(string endpoint, object body, string? sessionToken = null, CancellationToken ct = default);

    Task<SapResponse<T>> PatchAsync<T>(string endpoint, object body, string? sessionToken = null, CancellationToken ct = default);

    Task<SapResponse<bool>> DeleteAsync(string endpoint, string? sessionToken = null, CancellationToken ct = default);

    Task<SapResponse<T>> BatchAsync<T>(string endpoint, IEnumerable<SapBatchOperation> operations, string? sessionToken = null, CancellationToken ct = default);

    Task<SapResponse<T>> UploadAttachmentAsync<T>(string endpoint, byte[] fileBytes, string fileName, string? sessionToken = null, CancellationToken ct = default);
}

public record SapLoginResult(bool Success, string? SessionToken, string? ErrorMessage);

public record SapResponse<T>(bool Success, T? Data, int StatusCode, string? ErrorMessage, string? ErrorCode);

public record SapBatchOperation(string Method, string Endpoint, object? Body = null);
