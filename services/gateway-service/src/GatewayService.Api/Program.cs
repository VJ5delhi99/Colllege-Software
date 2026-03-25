using University360.BuildingBlocks;
var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<GatewayDbContext>();
builder.Services.AddHttpClient("identity", c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Identity"] ?? "http://identity-service:8080"));
builder.Services.AddHttpClient("academic", c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Academic"] ?? "http://academic-service:8080"));
var app = builder.Build();
app.UsePlatformDefaults();
app.MapGet("/", () => Results.Ok(new { service = "gateway-service", status = "ready" }));
app.MapGet("/bff/admin/overview", async (IHttpClientFactory factory) =>
{
    var academic = await factory.CreateClient("academic").GetFromJsonAsync<object>("/api/v1/dashboard/summary");
    var identity = await factory.CreateClient("identity").GetFromJsonAsync<object>("/api/v1/users");
    return Results.Ok(new { academic, identity });
});
app.Run();
public sealed class GatewayDbContext(Microsoft.EntityFrameworkCore.DbContextOptions<GatewayDbContext> options) : Microsoft.EntityFrameworkCore.DbContext(options) { }
