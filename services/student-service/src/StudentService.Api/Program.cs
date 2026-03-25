using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<StudentDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<StudentDbContext>();
await SeedAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "student-service", status = "ready" }));
app.MapGet("/api/v1/students", async (HttpContext httpContext, StudentDbContext db) =>
    await db.Students.Where(x => x.TenantId == httpContext.GetTenantId()).ToListAsync());
app.MapGet("/api/v1/students/{id:guid}", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Students.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == httpContext.GetTenantId()) is { } student ? Results.Ok(student) : Results.NotFound());
app.MapGet("/api/v1/students/{id:guid}/profile", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Students.Where(x => x.Id == id && x.TenantId == httpContext.GetTenantId()).Select(x => new { x.Id, x.Name, x.Department, x.Batch, x.Email, x.AcademicStatus }).FirstOrDefaultAsync() is { } profile ? Results.Ok(profile) : Results.NotFound());
app.MapGet("/api/v1/students/{id:guid}/enrollments", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Enrollments.Where(x => x.StudentId == id && x.TenantId == httpContext.GetTenantId()).OrderByDescending(x => x.EnrolledAtUtc).ToListAsync())
    .RequirePermissions("results.view");

app.MapPost("/api/v1/enrollments", async ([FromBody] EnrollmentRequest request, StudentDbContext db) =>
{
    var enrollment = new StudentEnrollment
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        StudentId = request.StudentId,
        CourseCode = request.CourseCode,
        SemesterCode = request.SemesterCode,
        Status = request.Status,
        EnrolledAtUtc = DateTimeOffset.UtcNow
    };

    db.Enrollments.Add(enrollment);
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/enrollments/{enrollment.Id}", enrollment);
}).RequirePermissions("rbac.manage");

app.Run();

static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<StudentDbContext>();
    if (!await db.Students.AnyAsync())
    {
        db.Students.Add(new StudentRecord { Id = Guid.Parse("00000000-0000-0000-0000-000000000123"), TenantId = "default", Name = "Aarav Sharma", Department = "Computer Science", Batch = "2022", Email = "student@university360.edu", AcademicStatus = "Active" });
    }

    if (!await db.Enrollments.AnyAsync())
    {
        db.Enrollments.Add(new StudentEnrollment
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
            CourseCode = "CSE401",
            SemesterCode = "2026-SPRING",
            Status = "Enrolled",
            EnrolledAtUtc = DateTimeOffset.UtcNow.AddDays(-20)
        });
    }

    await db.SaveChangesAsync();
}

public sealed record EnrollmentRequest(string TenantId, Guid StudentId, string CourseCode, string SemesterCode, string Status);

public sealed class StudentRecord
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Name { get; set; } = "";
    public string Department { get; set; } = "";
    public string Batch { get; set; } = "";
    public string Email { get; set; } = "";
    public string AcademicStatus { get; set; } = "";
}

public sealed class StudentEnrollment
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public string CourseCode { get; set; } = "";
    public string SemesterCode { get; set; } = "";
    public string Status { get; set; } = "Enrolled";
    public DateTimeOffset EnrolledAtUtc { get; set; }
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public sealed class StudentDbContext(DbContextOptions<StudentDbContext> options) : DbContext(options)
{
    public DbSet<StudentRecord> Students => Set<StudentRecord>();
    public DbSet<StudentEnrollment> Enrollments => Set<StudentEnrollment>();
}
