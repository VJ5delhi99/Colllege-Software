using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Memory;
using Yarp.ReverseProxy.Transforms;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<GatewayDbContext>();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<RouteGovernancePolicy>();
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(context =>
    {
        context.AddRequestTransform(transformContext =>
        {
            var tenantId = transformContext.HttpContext.User.FindFirst("tenant_id")?.Value
                ?? transformContext.HttpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault()
                ?? "default";
            transformContext.ProxyRequest.Headers.TryAddWithoutValidation("X-Tenant-Id", tenantId);
            var canary = transformContext.HttpContext.Request.Headers["X-Canary"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(canary))
            {
                transformContext.ProxyRequest.Headers.TryAddWithoutValidation("X-Canary", canary);
            }
            return ValueTask.CompletedTask;
        });
    });
builder.Services.AddHttpClient("identity", c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Identity"] ?? "http://identity-service:8080"));
builder.Services.AddHttpClient("academic", c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Academic"] ?? "http://academic-service:8080"));
builder.Services.AddHttpClient("finance", c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Finance"] ?? "http://finance-service:8080"));
builder.Services.AddHttpClient("attendance", c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Attendance"] ?? "http://attendance-service:8080"));
builder.Services.AddHttpClient("communication", c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Communication"] ?? "http://communication-service:8080"));

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<GatewayDbContext>();

app.Use(async (httpContext, next) =>
{
    var governance = httpContext.RequestServices.GetRequiredService<RouteGovernancePolicy>();
    if (governance.IsBlocked(httpContext))
    {
        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        await httpContext.Response.WriteAsJsonAsync(new { message = "Request blocked by gateway governance policy." });
        return;
    }

    if (!governance.IsAllowed(httpContext))
    {
        httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        return;
    }

    await next();
});

app.MapGet("/", () => Results.Ok(new { service = "gateway-service", status = "ready", mode = "yarp" }));

app.MapGet("/bff/admin/overview", async (HttpContext httpContext, IHttpClientFactory factory) =>
{
    var token = httpContext.Request.Headers.Authorization.ToString();
    var tenantId = httpContext.User.FindFirst("tenant_id")?.Value ?? httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
    var headers = new Dictionary<string, string>
    {
        ["Authorization"] = token,
        ["X-Tenant-Id"] = tenantId
    };

    async Task<object?> FetchAsync(string clientName, string path)
    {
        var client = factory.CreateClient(clientName);
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        foreach (var header in headers)
        {
            request.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<object>();
    }

    var academic = await FetchAsync("academic", "/api/v1/dashboard/summary");
    var identity = await FetchAsync("identity", "/api/v1/users");
    var finance = await FetchAsync("finance", "/api/v1/payments/summary");
    var attendance = await FetchAsync("attendance", "/api/v1/analytics/summary");
    var communication = await FetchAsync("communication", "/api/v1/dashboard/summary");

    return Results.Ok(new { academic, identity, finance, attendance, communication });
}).RequirePermissions("analytics.view");

app.MapReverseProxy(proxyPipeline =>
{
    proxyPipeline.Use(async (httpContext, next) =>
    {
        if (httpContext.Request.Path.StartsWithSegments("/api"))
        {
            await httpContext.AuthenticateAsync();
            if (httpContext.User.Identity?.IsAuthenticated != true)
            {
                httpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }
        }

        await next();
    });
});

app.Run();

public sealed class GatewayDbContext(Microsoft.EntityFrameworkCore.DbContextOptions<GatewayDbContext> options) : Microsoft.EntityFrameworkCore.DbContext(options) { }

public sealed class RouteGovernancePolicy(IMemoryCache cache)
{
    private static readonly string[] BlockedPatterns = ["<script", "../", "drop table", "%3cscript"];

    public bool IsBlocked(HttpContext httpContext)
    {
        var rawTarget = httpContext.Request.Path + httpContext.Request.QueryString;
        return BlockedPatterns.Any(pattern => rawTarget.Contains(pattern, StringComparison.OrdinalIgnoreCase));
    }

    public bool IsAllowed(HttpContext httpContext)
    {
        var key = $"gateway:{httpContext.Connection.RemoteIpAddress}:{httpContext.Request.Path}";
        var limit = httpContext.Request.Path.StartsWithSegments("/api/v2/payments") ? 30 : 120;
        var current = cache.Get<int?>(key) ?? 0;
        current++;
        cache.Set(key, current, TimeSpan.FromMinutes(1));
        return current <= limit;
    }
}
