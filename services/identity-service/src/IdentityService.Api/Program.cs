using IdentityService.Api.Api;
using IdentityService.Api.Infrastructure;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<IdentityDbContext>();
builder.Services.AddHttpClient<AuthorizationCatalogClient>(client =>
    client.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Authorization"] ?? "http://authorization-service:8080"));
builder.Services.AddHttpClient<NotificationDeliveryService>();
builder.Services.AddSingleton<OidcClientCatalog>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<IdentityDbContext>();
await IdentitySeeder.SeedIdentityDataAsync(app);

app.MapIdentityEndpoints();

app.Run();
