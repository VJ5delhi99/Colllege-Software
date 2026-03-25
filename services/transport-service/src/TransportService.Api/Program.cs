using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;
var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<TransportDbContext>();
var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<TransportDbContext>();
await SeedAsync(app);
app.MapGet("/", () => Results.Ok(new { service = "transport-service", status = "ready" }));
app.MapGet("/api/v1/routes", async (TransportDbContext db) => await db.Routes.ToListAsync());
app.MapGet("/api/v1/tracking", async (TransportDbContext db) => await db.Trackers.ToListAsync());
app.Run();
static async Task SeedAsync(WebApplication app){ using var s=app.Services.CreateScope(); var db=s.ServiceProvider.GetRequiredService<TransportDbContext>(); if(await db.Routes.AnyAsync()) return; db.Routes.Add(new BusRoute{Id=Guid.NewGuid(),BusNumber="BUS-12",RouteName="North Campus Loop",Driver="Suresh",SeatsAvailable=14}); db.Trackers.Add(new GpsTracker{Id=Guid.NewGuid(),BusNumber="BUS-12",Latitude=12.9716m,Longitude=77.5946m,UpdatedAtUtc=DateTimeOffset.UtcNow}); await db.SaveChangesAsync(); }
public sealed class BusRoute{ public Guid Id{get;set;} public string BusNumber{get;set;}=""; public string RouteName{get;set;}=""; public string Driver{get;set;}=""; public int SeatsAvailable{get;set;} }
public sealed class GpsTracker{ public Guid Id{get;set;} public string BusNumber{get;set;}=""; public decimal Latitude{get;set;} public decimal Longitude{get;set;} public DateTimeOffset UpdatedAtUtc{get;set;} }
public sealed class TransportDbContext(DbContextOptions<TransportDbContext> options):DbContext(options){ public DbSet<BusRoute> Routes=>Set<BusRoute>(); public DbSet<GpsTracker> Trackers=>Set<GpsTracker>(); }
