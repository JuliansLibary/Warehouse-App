using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Infrastructure.Sap;

/// <summary>
/// SAP Service Layer client using Cookie-based (B1SESSION) authentication.
/// Mimics the original B1SL.js cookie handling from nAG.ServiceLayerConnector.
/// </summary>
public class CookieSapClient : BaseSapClient
{
    public CookieSapClient(HttpClient httpClient, SapClientOptions options, ILogger<CookieSapClient> logger)
        : base(httpClient, options, logger)
    {
    }

    protected override void SetAuthHeader(HttpRequestMessage request, string? sessionToken)
    {
        if (!string.IsNullOrEmpty(sessionToken))
            request.Headers.Add("Cookie", $"B1SESSION={sessionToken}");
    }

    public override async Task<SapLoginResult> LoginAsync(string username, string password, string companyDb, CancellationToken ct = default)
    {
        var body = new { UserName = username, Password = password, CompanyDB = companyDb };
        var json = JsonSerializer.Serialize(body);

        var request = new HttpRequestMessage(HttpMethod.Post, BuildUrl("Login"))
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Prefer", $"odata.maxpagesize={_options.PageSize}");

        try
        {
            var response = await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errContent = await response.Content.ReadAsStringAsync(ct);
                return new SapLoginResult(false, null, ExtractError(errContent));
            }

            // Extract B1SESSION from Set-Cookie header
            var sessionToken = ExtractB1Session(response);
            if (sessionToken == null)
                return new SapLoginResult(false, null, "B1SESSION cookie not found in response");

            _logger.LogInformation("SAP Login successful for user {Username} on {CompanyDb}", username, companyDb);
            return new SapLoginResult(true, sessionToken, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SAP Login failed for user {Username}", username);
            return new SapLoginResult(false, null, ex.Message);
        }
    }

    public override async Task LogoutAsync(string? sessionToken = null, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(sessionToken)) return;

        var request = new HttpRequestMessage(HttpMethod.Post, BuildUrl("Logout"));
        SetAuthHeader(request, sessionToken);

        try
        {
            await _httpClient.SendAsync(request, ct);
            _logger.LogInformation("SAP Logout successful");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SAP Logout failed (non-critical)");
        }
    }

    private static string? ExtractB1Session(HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var cookies)) return null;

        foreach (var cookie in cookies)
        {
            // Format: B1SESSION=value; path=/; ...
            var parts = cookie.Split(';');
            foreach (var part in parts)
            {
                var kv = part.Trim().Split('=', 2);
                if (kv.Length == 2 && kv[0].Trim().Equals("B1SESSION", StringComparison.OrdinalIgnoreCase))
                    return Uri.UnescapeDataString(kv[1].Trim());
            }
        }
        return null;
    }

    private static string ExtractError(string content)
    {
        try
        {
            var doc = JsonDocument.Parse(content);
            if (doc.RootElement.TryGetProperty("error", out var err) &&
                err.TryGetProperty("message", out var msg))
                return msg.GetString() ?? content;
        }
        catch { }
        return content;
    }
}
