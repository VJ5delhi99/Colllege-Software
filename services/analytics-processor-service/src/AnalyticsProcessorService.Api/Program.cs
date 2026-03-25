using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<AnalyticsProcessorDbContext>();
builder.Services.Configure<ClickHouseOptions>(builder.Configuration.GetSection("Analytics:ClickHouse"));
builder.Services.AddHttpClient<ClickHouseExporter>();
builder.Services.AddHostedService<ProjectionExportWorker>();
builder.Services.AddHostedService<ClickHouseSchemaBootstrapWorker>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<AnalyticsProcessorDbContext>();

app.MapGet("/", () => Results.Ok(new { service = "analytics-processor-service", sink = "clickhouse-http" }));

app.MapPost("/api/v1/events", async ([FromBody] AnalyticsEventRequest request, AnalyticsProcessorDbContext dbContext) =>
{
    var pending = new AnalyticsEventEnvelope
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        EventType = request.EventType,
        PayloadJson = request.PayloadJson,
        OccurredAtUtc = request.OccurredAtUtc,
        ExportStatus = "Pending"
    };

    dbContext.Events.Add(pending);
    await dbContext.SaveChangesAsync();
    return Results.Accepted($"/api/v1/events/{pending.Id}", pending);
}).RequirePermissions("analytics.view");

app.MapGet("/api/v1/events/export-status", async (AnalyticsProcessorDbContext dbContext) =>
{
    var grouped = await dbContext.Events
        .GroupBy(x => x.ExportStatus)
        .Select(group => new { status = group.Key, count = group.Count() })
        .ToListAsync();

    return Results.Ok(grouped);
}).RequirePermissions("analytics.view");

app.MapGet("/api/v1/dashboard/attendance-trends", async (AnalyticsProcessorDbContext dbContext) =>
{
    var data = await dbContext.Events
        .Where(x => x.EventType.Contains("Attendance", StringComparison.OrdinalIgnoreCase))
        .GroupBy(x => x.OccurredAtUtc.Date)
        .Select(group => new { date = group.Key, count = group.Count() })
        .OrderBy(x => x.date)
        .ToListAsync();
    return Results.Ok(data);
}).RequirePermissions("analytics.view");

app.MapGet("/api/v1/dashboard/payment-statistics", async (AnalyticsProcessorDbContext dbContext) =>
{
    var data = await dbContext.Events
        .Where(x => x.EventType.Contains("Payment", StringComparison.OrdinalIgnoreCase))
        .GroupBy(x => x.EventType)
        .Select(group => new { eventType = group.Key, count = group.Count() })
        .OrderByDescending(x => x.count)
        .ToListAsync();
    return Results.Ok(data);
}).RequirePermissions("analytics.view");

app.MapGet("/api/v1/dashboard/course-engagement", async (AnalyticsProcessorDbContext dbContext) =>
{
    var data = await dbContext.Events
        .Where(x => x.EventType.Contains("Course", StringComparison.OrdinalIgnoreCase) || x.EventType.Contains("Assignment", StringComparison.OrdinalIgnoreCase))
        .GroupBy(x => x.EventType)
        .Select(group => new { metric = group.Key, count = group.Count() })
        .OrderByDescending(x => x.count)
        .ToListAsync();
    return Results.Ok(data);
}).RequirePermissions("analytics.view");

app.Run();

public sealed record AnalyticsEventRequest(string TenantId, string EventType, string PayloadJson, DateTimeOffset OccurredAtUtc);

public sealed class AnalyticsEventEnvelope
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset OccurredAtUtc { get; set; }
    public string ExportStatus { get; set; } = "Pending";
    public DateTimeOffset? ExportedAtUtc { get; set; }
}

public sealed class AnalyticsProcessorDbContext(DbContextOptions<AnalyticsProcessorDbContext> options) : DbContext(options)
{
    public DbSet<AnalyticsEventEnvelope> Events => Set<AnalyticsEventEnvelope>();
}

public sealed class ClickHouseOptions
{
    public string Endpoint { get; set; } = "http://clickhouse:8123";
    public string Database { get; set; } = "university360_analytics";
}

public sealed class ClickHouseExporter(HttpClient httpClient, IConfiguration configuration, ILogger<ClickHouseExporter> logger)
{
    public async Task EnsureSchemaAsync(CancellationToken cancellationToken)
    {
        var endpoint = configuration["Analytics:ClickHouse:Endpoint"] ?? "http://clickhouse:8123";
        var database = configuration["Analytics:ClickHouse:Database"] ?? "university360_analytics";
        using var response = await httpClient.PostAsync($"{endpoint}/?query=CREATE%20DATABASE%20IF%20NOT%20EXISTS%20{database}", content: null, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("ClickHouse database bootstrap failed with status {StatusCode}", response.StatusCode);
            return;
        }

        using var tableResponse = await httpClient.PostAsync($"{endpoint}/?database={database}&query=CREATE%20TABLE%20IF%20NOT%20EXISTS%20analytics_events%20(tenantId%20String,%20eventType%20String,%20payload%20String,%20occurredAtUtc%20DateTime64(3))%20ENGINE%20=%20MergeTree%20ORDER%20BY%20(tenantId,%20eventType,%20occurredAtUtc)", content: null, cancellationToken);
        if (!tableResponse.IsSuccessStatusCode)
        {
            logger.LogWarning("ClickHouse table bootstrap failed with status {StatusCode}", tableResponse.StatusCode);
        }
    }

    public async Task<bool> ExportAsync(IReadOnlyCollection<AnalyticsEventEnvelope> batch, CancellationToken cancellationToken)
    {
        if (batch.Count == 0)
        {
            return true;
        }

        var endpoint = configuration["Analytics:ClickHouse:Endpoint"] ?? "http://clickhouse:8123";
        var database = configuration["Analytics:ClickHouse:Database"] ?? "university360_analytics";
        var rows = string.Join('\n', batch.Select(evt => $$"""{"tenantId":"{{evt.TenantId}}","eventType":"{{evt.EventType}}","payload":"{{evt.PayloadJson.Replace("\"", "\\\"")}}","occurredAtUtc":"{{evt.OccurredAtUtc:O}}"}"""));
        using var content = new StringContent(rows);
        using var response = await httpClient.PostAsync($"{endpoint}/?database={database}&query=INSERT%20INTO%20analytics_events%20FORMAT%20JSONEachRow", content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("ClickHouse export failed with status {StatusCode}", response.StatusCode);
        }

        return response.IsSuccessStatusCode;
    }
}

public sealed class ClickHouseSchemaBootstrapWorker(ClickHouseExporter exporter, ILogger<ClickHouseSchemaBootstrapWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await exporter.EnsureSchemaAsync(stoppingToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "ClickHouse schema bootstrap failed");
        }
    }
}

public sealed class ProjectionExportWorker(IServiceProvider serviceProvider, ClickHouseExporter exporter, ILogger<ProjectionExportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<AnalyticsProcessorDbContext>();
                var batch = await dbContext.Events.Where(x => x.ExportStatus == "Pending").OrderBy(x => x.OccurredAtUtc).Take(50).ToListAsync(stoppingToken);
                if (batch.Count > 0)
                {
                    var exported = await exporter.ExportAsync(batch, stoppingToken);
                    if (exported)
                    {
                        foreach (var item in batch)
                        {
                            item.ExportStatus = "Exported";
                            item.ExportedAtUtc = DateTimeOffset.UtcNow;
                        }

                        await dbContext.SaveChangesAsync(stoppingToken);
                    }
                }
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Analytics projection export failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }
}
