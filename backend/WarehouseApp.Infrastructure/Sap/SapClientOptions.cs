namespace WarehouseApp.Infrastructure.Sap;

public class SapClientOptions
{
    public string SlUrl { get; set; } = string.Empty;
    public string SlPort { get; set; } = string.Empty;
    public int RetryCount { get; set; } = 5;
    public int RetryDelayMs { get; set; } = 500;
    public int PageSize { get; set; } = 1000;
    public bool IgnoreSslErrors { get; set; } = true; // SAP B1 uses self-signed certs
    public string ApiPath { get; set; } = "/b1s/v2";
}
