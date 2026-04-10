using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WarehouseApp.API.Controllers;

/// <summary>
/// Admin utility endpoints (log viewer, health info).
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AdminController> _logger;

    public AdminController(IWebHostEnvironment env, ILogger<AdminController> logger)
    {
        _env = env;
        _logger = logger;
    }

    /// <summary>
    /// Returns the last N lines from today's rolling log file.
    /// The file path matches Serilog's WriteTo.File("logs/warehouse-app-.log", RollingInterval.Day) config.
    /// </summary>
    [HttpGet("logs")]
    public IActionResult GetLogs([FromQuery] int lines = 200)
    {
        try
        {
            // Serilog writes relative to the working directory of the process.
            // In Docker the working dir is /app, so logs end up at /app/logs/.
            var logDir = Path.GetFullPath("logs");
            if (!Directory.Exists(logDir))
                return Ok(new { lines = Array.Empty<string>(), note = "Log directory not found" });

            // Find the most-recently modified log file (today's rolling file first)
            var logFile = Directory.GetFiles(logDir, "warehouse-app-*.log")
                .OrderByDescending(File.GetLastWriteTimeUtc)
                .FirstOrDefault();

            if (logFile == null)
                return Ok(new { lines = Array.Empty<string>(), note = "No log files found" });

            // Read with shared access so Serilog can continue writing
            string[] allLines;
            using (var fs = new FileStream(logFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            using (var reader = new StreamReader(fs))
            {
                allLines = reader.ReadToEnd().Split('\n', StringSplitOptions.RemoveEmptyEntries);
            }

            var last = allLines.TakeLast(Math.Clamp(lines, 1, 5000)).ToArray();
            return Ok(new { lines = last, file = Path.GetFileName(logFile), total = allLines.Length });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read log file");
            return StatusCode(500, new { message = "Could not read log file", detail = ex.Message });
        }
    }
}
