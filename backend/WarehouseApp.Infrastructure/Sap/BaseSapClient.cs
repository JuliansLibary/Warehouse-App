using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Infrastructure.Sap;

/// <summary>
/// Base implementation for SAP Service Layer client.
/// Handles retry logic, pagination, JSON parsing, error mapping.
/// </summary>
public abstract class BaseSapClient : ISapServiceLayerClient
{
    protected readonly HttpClient _httpClient;
    protected readonly SapClientOptions _options;
    protected readonly ILogger _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = null
    };

    protected BaseSapClient(HttpClient httpClient, SapClientOptions options, ILogger logger)
    {
        _httpClient = httpClient;
        _options = options;
        _logger = logger;
    }

    protected string BuildUrl(string endpoint)
        => $"https://{_options.SlUrl}:{_options.SlPort}{_options.ApiPath}/{endpoint.TrimStart('/')}";

    protected abstract void SetAuthHeader(HttpRequestMessage request, string? sessionToken);

    public abstract Task<SapLoginResult> LoginAsync(string username, string password, string companyDb, CancellationToken ct = default);
    public abstract Task LogoutAsync(string? sessionToken = null, CancellationToken ct = default);

    public async Task<SapResponse<T>> GetAsync<T>(string endpoint, string? sessionToken = null, CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync<T>(async () =>
        {
            // Handle OData pagination automatically
            var allValues = new List<object>();
            string? nextLink = BuildUrl(endpoint);
            bool isPaginated = false;

            while (nextLink != null)
            {
                var request = new HttpRequestMessage(HttpMethod.Get, nextLink);
                request.Headers.Add("Prefer", $"odata.maxpagesize={_options.PageSize}");
                SetAuthHeader(request, sessionToken);

                var response = await _httpClient.SendAsync(request, ct);
                var content = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                    return new SapResponse<T>(false, default, (int)response.StatusCode, ExtractErrorMessage(content), null);

                var json = JsonDocument.Parse(content);

                if (json.RootElement.TryGetProperty("value", out var valueArray))
                {
                    isPaginated = true;
                    foreach (var item in valueArray.EnumerateArray())
                        allValues.Add(item);

                    nextLink = json.RootElement.TryGetProperty("@odata.nextLink", out var nl)
                        ? NormalizeNextLink(nl.GetString())
                        : null;
                }
                else
                {
                    // Single object response
                    var result = JsonSerializer.Deserialize<T>(content, _jsonOptions);
                    return new SapResponse<T>(true, result, (int)response.StatusCode, null, null);
                }
            }

            if (isPaginated)
            {
                var combinedJson = JsonSerializer.Serialize(new { value = allValues });
                var paginated = JsonSerializer.Deserialize<T>(combinedJson, _jsonOptions);
                return new SapResponse<T>(true, paginated, 200, null, null);
            }

            return new SapResponse<T>(false, default, 204, null, null);
        }, ct);
    }

    public async Task<SapResponse<T>> PostAsync<T>(string endpoint, object body, string? sessionToken = null, CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync<T>(async () =>
        {
            var request = new HttpRequestMessage(HttpMethod.Post, BuildUrl(endpoint))
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            request.Headers.Add("Prefer", $"odata.maxpagesize={_options.PageSize}");
            SetAuthHeader(request, sessionToken);

            var response = await _httpClient.SendAsync(request, ct);
            var content = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
                return new SapResponse<T>(false, default, (int)response.StatusCode, ExtractErrorMessage(content), null);

            var result = string.IsNullOrWhiteSpace(content)
                ? default
                : JsonSerializer.Deserialize<T>(content, _jsonOptions);
            return new SapResponse<T>(true, result, (int)response.StatusCode, null, null);
        }, ct);
    }

    public async Task<SapResponse<T>> PatchAsync<T>(string endpoint, object body, string? sessionToken = null, CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync<T>(async () =>
        {
            var request = new HttpRequestMessage(HttpMethod.Patch, BuildUrl(endpoint))
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            SetAuthHeader(request, sessionToken);

            var response = await _httpClient.SendAsync(request, ct);
            if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
                return new SapResponse<T>(true, default, 204, null, null);

            var content = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                return new SapResponse<T>(false, default, (int)response.StatusCode, ExtractErrorMessage(content), null);

            var result = JsonSerializer.Deserialize<T>(content, _jsonOptions);
            return new SapResponse<T>(true, result, (int)response.StatusCode, null, null);
        }, ct);
    }

    public async Task<SapResponse<bool>> DeleteAsync(string endpoint, string? sessionToken = null, CancellationToken ct = default)
    {
        return await ExecuteWithRetryAsync<bool>(async () =>
        {
            var request = new HttpRequestMessage(HttpMethod.Delete, BuildUrl(endpoint));
            SetAuthHeader(request, sessionToken);

            var response = await _httpClient.SendAsync(request, ct);
            return new SapResponse<bool>(response.IsSuccessStatusCode, response.IsSuccessStatusCode,
                (int)response.StatusCode, response.IsSuccessStatusCode ? null : "Delete failed", null);
        }, ct);
    }

    public async Task<SapResponse<T>> BatchAsync<T>(string endpoint, IEnumerable<SapBatchOperation> operations, string? sessionToken = null, CancellationToken ct = default)
    {
        var boundary = $"batch_{Guid.NewGuid():N}";
        var sb = new StringBuilder();

        foreach (var op in operations)
        {
            sb.AppendLine($"--{boundary}");
            sb.AppendLine("Content-Type: application/http");
            sb.AppendLine("Content-Transfer-Encoding: binary");
            sb.AppendLine();
            sb.AppendLine($"{op.Method} {_options.ApiPath}/{op.Endpoint} HTTP/1.1");
            if (op.Body != null)
            {
                var bodyJson = JsonSerializer.Serialize(op.Body);
                sb.AppendLine("Content-Type: application/json");
                sb.AppendLine();
                sb.AppendLine(bodyJson);
            }
        }
        sb.AppendLine($"--{boundary}--");

        var request = new HttpRequestMessage(HttpMethod.Post, BuildUrl("$batch"))
        {
            Content = new StringContent(sb.ToString(), Encoding.UTF8, $"multipart/mixed; boundary={boundary}")
        };
        SetAuthHeader(request, sessionToken);

        var response = await _httpClient.SendAsync(request, ct);
        var content = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            return new SapResponse<T>(false, default, (int)response.StatusCode, ExtractErrorMessage(content), null);

        var result = JsonSerializer.Deserialize<T>(content, _jsonOptions);
        return new SapResponse<T>(true, result, (int)response.StatusCode, null, null);
    }

    public async Task<SapResponse<T>> UploadAttachmentAsync<T>(string endpoint, byte[] fileBytes, string fileName, string? sessionToken = null, CancellationToken ct = default)
    {
        var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(fileBytes), "file", fileName);

        var request = new HttpRequestMessage(HttpMethod.Post, BuildUrl(endpoint)) { Content = form };
        SetAuthHeader(request, sessionToken);

        var response = await _httpClient.SendAsync(request, ct);
        var content = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            return new SapResponse<T>(false, default, (int)response.StatusCode, ExtractErrorMessage(content), null);

        var result = JsonSerializer.Deserialize<T>(content, _jsonOptions);
        return new SapResponse<T>(true, result, (int)response.StatusCode, null, null);
    }

    private async Task<SapResponse<T>> ExecuteWithRetryAsync<T>(Func<Task<SapResponse<T>>> action, CancellationToken ct)
    {
        var attempts = 0;
        while (true)
        {
            try
            {
                return await action();
            }
            catch (Exception ex) when (attempts < _options.RetryCount)
            {
                attempts++;
                _logger.LogWarning(ex, "SAP SL request failed (attempt {Attempt}/{Max}), retrying in {Delay}ms",
                    attempts, _options.RetryCount, _options.RetryDelayMs);
                await Task.Delay(_options.RetryDelayMs * attempts, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SAP SL request failed after {Max} retries", _options.RetryCount);
                return new SapResponse<T>(false, default, 500, ex.Message, null);
            }
        }
    }

    private string? NormalizeNextLink(string? link)
    {
        if (string.IsNullOrEmpty(link)) return null;
        if (link.Contains("/b1s/v2/"))
            return BuildUrl(Uri.UnescapeDataString(link.Split("/b1s/v2/").Last()));
        return Uri.UnescapeDataString(link);
    }

    private static string ExtractErrorMessage(string content)
    {
        try
        {
            var doc = JsonDocument.Parse(content);
            if (doc.RootElement.TryGetProperty("error", out var error))
            {
                if (error.TryGetProperty("message", out var msg))
                    return msg.GetString() ?? content;
            }
        }
        catch { }
        return content;
    }
}
