using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<HostelDbContext>();
var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<HostelDbContext>();
await SeedAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "hostel-service", status = "ready" }));
app.MapGet("/api/v1/rooms", async (HostelDbContext db) => await db.Rooms.ToListAsync());
app.MapPost("/api/v1/allocations", async (RoomAllocation allocation, HostelDbContext db) =>
{
    allocation.Id = Guid.NewGuid();
    db.Allocations.Add(allocation);
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/allocations/{allocation.Id}", allocation);
}).RequireRoles("Admin", "FinanceStaff");
app.MapGet("/api/v1/visitor-logs", async (HostelDbContext db) => await db.Visitors.ToListAsync());
app.Run();

static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<HostelDbContext>();
    if (await db.Rooms.AnyAsync()) return;
    db.Rooms.Add(new HostelRoom { Id = Guid.NewGuid(), Block = "A", RoomNumber = "A-204", Capacity = 2, Occupied = 1 });
    db.Visitors.Add(new VisitorLog { Id = Guid.NewGuid(), VisitorName = "Rohit Sharma", StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"), VisitDateUtc = DateTimeOffset.UtcNow.AddDays(-1) });
    await db.SaveChangesAsync();
}

public sealed class HostelRoom { public Guid Id { get; set; } public string Block { get; set; } = ""; public string RoomNumber { get; set; } = ""; public int Capacity { get; set; } public int Occupied { get; set; } }
public sealed class RoomAllocation { public Guid Id { get; set; } public Guid StudentId { get; set; } public string RoomNumber { get; set; } = ""; public decimal HostelFee { get; set; } }
public sealed class VisitorLog { public Guid Id { get; set; } public Guid StudentId { get; set; } public string VisitorName { get; set; } = ""; public DateTimeOffset VisitDateUtc { get; set; } }
public sealed class HostelDbContext(DbContextOptions<HostelDbContext> options) : DbContext(options) { public DbSet<HostelRoom> Rooms => Set<HostelRoom>(); public DbSet<RoomAllocation> Allocations => Set<RoomAllocation>(); public DbSet<VisitorLog> Visitors => Set<VisitorLog>(); }
