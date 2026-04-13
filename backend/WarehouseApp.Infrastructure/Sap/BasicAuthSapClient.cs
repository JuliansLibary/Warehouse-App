using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Infrastructure.Sap;

/// <summary>
/// SAP Service Layer client using Basic Authentication.
/// Encodes credentials as Base64 per request (stateless).
/// Compatible with SAP B1 Service Layer basic auth format:
/// Base64( '{"UserName":"...","CompanyDB":"..."}:password' )
/// </summary>
public class BasicAuthSapClient : BaseSapClient
{
    private string? _basicAuthHeader;

    public BasicAuthSapClient(HttpClient httpClient, SapClientOptions options, ILogger<BasicAuthSapClient> logger)
        : base(httpClient, options, logger)
    {
    }

    protected override void SetAuthHeader(HttpRequestMessage request, string? sessionToken)
    {
        // sessionToken contains the basic auth header value in BasicAuth mode
        var authValue = sessionToken ?? _basicAuthHeader;
        if (!string.IsNullOrEmpty(authValue))
            request.Headers.Add("Authorization", authValue);
    }

    public override Task<SapLoginResult> LoginAsync(string username, string password, string companyDb, CancellationToken ct = default)
    {
        // For BasicAuth, we just encode the credentials – no actual HTTP call needed
        // SAP B1 Basic Auth format: Base64('{"UserName":"user","CompanyDB":"db"}:password')
        var credentials = $"{{\"UserName\": \"{username}\", \"CompanyDB\": \"{companyDb}\"}}:{password}";
        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(credentials));
        _basicAuthHeader = $"Basic {encoded}";

        _logger.LogInformation("BasicAuth credentials prepared for user {Username} on {CompanyDb}", username, companyDb);
        return Task.FromResult(new SapLoginResult(true, _basicAuthHeader, null));
    }

    public override Task LogoutAsync(string? sessionToken = null, CancellationToken ct = default)
    {
        // BasicAuth is stateless – nothing to logout
        _basicAuthHeader = null;
        return Task.CompletedTask;
    }
}
