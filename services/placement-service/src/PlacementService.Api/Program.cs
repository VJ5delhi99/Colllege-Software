using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;
var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<PlacementDbContext>();
var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<PlacementDbContext>();
await SeedAsync(app);
app.MapGet("/",()=>Results.Ok(new{service="placement-service",status="ready"}));
app.MapGet("/api/v1/drives", async (PlacementDbContext db)=> await db.Drives.ToListAsync());
app.MapGet("/api/v1/interviews", async (PlacementDbContext db)=> await db.Interviews.ToListAsync());
app.MapGet("/api/v1/analytics", async (PlacementDbContext db)=> Results.Ok(new{ placementRate = 84, totalDrives = await db.Drives.CountAsync()}));
app.Run();
static async Task SeedAsync(WebApplication app){ using var s=app.Services.CreateScope(); var db=s.ServiceProvider.GetRequiredService<PlacementDbContext>(); if(await db.Drives.AnyAsync()) return; db.Drives.Add(new PlacementDrive{Id=Guid.NewGuid(),Company="Contoso",Role="Software Engineer",ScheduledDateUtc=DateTimeOffset.UtcNow.AddDays(7)}); db.Interviews.Add(new InterviewSchedule{Id=Guid.NewGuid(),StudentId=Guid.Parse("00000000-0000-0000-0000-000000000123"),Company="Contoso",SlotUtc=DateTimeOffset.UtcNow.AddDays(8)}); await db.SaveChangesAsync(); }
public sealed class PlacementDrive{ public Guid Id{get;set;} public string Company{get;set;}=""; public string Role{get;set;}=""; public DateTimeOffset ScheduledDateUtc{get;set;} }
public sealed class InterviewSchedule{ public Guid Id{get;set;} public Guid StudentId{get;set;} public string Company{get;set;}=""; public DateTimeOffset SlotUtc{get;set;} }
public sealed class PlacementDbContext(DbContextOptions<PlacementDbContext> options):DbContext(options){ public DbSet<PlacementDrive> Drives=>Set<PlacementDrive>(); public DbSet<InterviewSchedule> Interviews=>Set<InterviewSchedule>(); }
