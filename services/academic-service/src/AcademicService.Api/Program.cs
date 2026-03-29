using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<AcademicDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<AcademicDbContext>();
await SeedAcademicDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "academic-service", status = "ready" }));

app.MapPost("/api/v1/courses", async (HttpContext httpContext, [FromBody] CreateCourseRequest request, AcademicDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var course = new Course
    {
        Id = Guid.NewGuid(),
        TenantId = httpContext.GetValidatedTenantId(),
        CourseCode = request.CourseCode,
        Title = request.Title,
        Credits = request.Credits,
        SemesterCode = request.SemesterCode,
        FacultyId = request.FacultyId,
        DayOfWeek = request.DayOfWeek,
        StartTime = request.StartTime,
        Room = request.Room
    };

    dbContext.Courses.Add(course);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/courses/{course.Id}", course);
}).RequirePermissions("rbac.manage").RequireRateLimiting("api");

app.MapGet("/api/v1/courses", async (HttpContext httpContext, AcademicDbContext dbContext, string? search, string? semesterCode, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.Courses.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(x => x.CourseCode.Contains(search) || x.Title.Contains(search) || x.Room.Contains(search));
    }

    if (!string.IsNullOrWhiteSpace(semesterCode))
    {
        query = query.Where(x => x.SemesterCode == semesterCode);
    }

    var total = await query.CountAsync();
    var items = await query.OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("results.view");

app.MapGet("/api/v1/dashboard/summary", async (HttpContext httpContext, AcademicDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var nextCourse = await dbContext.Courses.Where(x => x.TenantId == tenantId).OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).FirstOrDefaultAsync();
    var totalCourses = await dbContext.Courses.CountAsync(x => x.TenantId == tenantId);

    return Results.Ok(new
    {
        totalCourses,
        nextCourse
    });
}).RequirePermissions("results.view");

app.Run();

static async Task SeedAcademicDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AcademicDbContext>();
    if (await dbContext.Courses.AnyAsync())
    {
        return;
    }

    dbContext.Courses.AddRange(
    [
        new Course
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CourseCode = "CSE401",
            Title = "Distributed Systems",
            Credits = 4,
            SemesterCode = "2026-SPRING",
            FacultyId = KnownUsers.ProfessorId,
            DayOfWeek = "Monday",
            StartTime = "02:00 PM",
            Room = "B-204"
        },
        new Course
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CourseCode = "PHY201",
            Title = "Physics",
            Credits = 3,
            SemesterCode = "2026-SPRING",
            FacultyId = KnownUsers.ProfessorId,
            DayOfWeek = "Tuesday",
            StartTime = "10:00 AM",
            Room = "Lab-2"
        },
        new Course
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CourseCode = "MTH301",
            Title = "Advanced Mathematics",
            Credits = 3,
            SemesterCode = "2026-SPRING",
            FacultyId = KnownUsers.ProfessorId,
            DayOfWeek = "Wednesday",
            StartTime = "11:30 AM",
            Room = "A-112"
        }
    ]);

    await dbContext.SaveChangesAsync();
}

public sealed record CreateCourseRequest(
    string TenantId,
    string CourseCode,
    string Title,
    int Credits,
    string SemesterCode,
    Guid FacultyId,
    string DayOfWeek,
    string StartTime,
    string Room);

public sealed class Course
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string CourseCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int Credits { get; set; }
    public string SemesterCode { get; set; } = string.Empty;
    public Guid FacultyId { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
}

public sealed class AcademicDbContext(DbContextOptions<AcademicDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
    public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999");
}
