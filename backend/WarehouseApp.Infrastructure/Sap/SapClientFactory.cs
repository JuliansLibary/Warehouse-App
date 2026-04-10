using Microsoft.Extensions.Logging;
using WarehouseApp.Domain.Entities;
using WarehouseApp.Domain.Enums;
using WarehouseApp.Domain.Interfaces;

namespace WarehouseApp.Infrastructure.Sap;

/// <summary>
/// Creates the appropriate SAP client based on instance AuthMode.
/// Allows switching between BasicAuth and Cookie per instance.
/// </summary>
public class SapClientFactory
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILoggerFactory _loggerFactory;

    public SapClientFactory(IHttpClientFactory httpClientFactory, ILoggerFactory loggerFactory)
    {
        _httpClientFactory = httpClientFactory;
        _loggerFactory = loggerFactory;
    }

    public ISapServiceLayerClient Create(Instance instance)
    {
        var options = new SapClientOptions
        {
            SlUrl = instance.SlUrl,
            SlPort = instance.SlPort,
            IgnoreSslErrors = true
        };

        var httpClient = _httpClientFactory.CreateClient("SapServiceLayer");

        return instance.AuthMode switch
        {
            SapAuthMode.BasicAuth => new BasicAuthSapClient(
                httpClient, options,
                _loggerFactory.CreateLogger<BasicAuthSapClient>()),

            SapAuthMode.Cookie => new CookieSapClient(
                httpClient, options,
                _loggerFactory.CreateLogger<CookieSapClient>()),

            _ => throw new ArgumentOutOfRangeException(nameof(instance.AuthMode), "Unknown auth mode")
        };
    }
}
