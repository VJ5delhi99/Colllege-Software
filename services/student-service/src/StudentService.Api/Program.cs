using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<StudentDbContext>();
var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<StudentDbContext>();
await SeedAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "student-service", status = "ready" }));
app.MapGet("/api/v1/students", async (StudentDbContext db) => await db.Students.ToListAsync());
app.MapGet("/api/v1/students/{id:guid}", async (Guid id, StudentDbContext db) =>
    await db.Students.FirstOrDefaultAsync(x => x.Id == id) is { } student ? Results.Ok(student) : Results.NotFound());
app.MapGet("/api/v1/students/{id:guid}/profile", async (Guid id, StudentDbContext db) =>
    await db.Students.Where(x => x.Id == id).Select(x => new { x.Id, x.Name, x.Department, x.Batch, x.Email, x.AcademicStatus }).FirstOrDefaultAsync() is { } profile ? Results.Ok(profile) : Results.NotFound());
app.Run();

static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<StudentDbContext>();
    if (await db.Students.AnyAsync()) return;
    db.Students.Add(new StudentRecord { Id = Guid.Parse("00000000-0000-0000-0000-000000000123"), Name = "Aarav Sharma", Department = "Computer Science", Batch = "2022", Email = "student@university360.edu", AcademicStatus = "Active" });
    await db.SaveChangesAsync();
}

public sealed class StudentRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Department { get; set; } = "";
    public string Batch { get; set; } = "";
    public string Email { get; set; } = "";
    public string AcademicStatus { get; set; } = "";
}

public sealed class StudentDbContext(DbContextOptions<StudentDbContext> options) : DbContext(options)
{
    public DbSet<StudentRecord> Students => Set<StudentRecord>();
}
