using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddPlatformDefaults<AcademicDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await SeedAcademicDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "academic-service", status = "ready" }));

app.MapPost("/api/v1/courses", async ([FromBody] CreateCourseRequest request, AcademicDbContext dbContext) =>
{
    var course = new Course
    {
        Id = Guid.NewGuid(),
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
}).RequireRateLimiting("api");

app.MapGet("/api/v1/courses", async (AcademicDbContext dbContext) =>
    await dbContext.Courses.OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).ToListAsync());

app.MapGet("/api/v1/dashboard/summary", async (AcademicDbContext dbContext) =>
{
    var nextCourse = await dbContext.Courses.OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).FirstOrDefaultAsync();
    var totalCourses = await dbContext.Courses.CountAsync();

    return Results.Ok(new
    {
        totalCourses,
        nextCourse
    });
});

app.Run();

static async Task SeedAcademicDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AcademicDbContext>();
    await dbContext.Database.EnsureCreatedAsync();

    if (await dbContext.Courses.AnyAsync())
    {
        return;
    }

    dbContext.Courses.AddRange(
    [
        new Course
        {
            Id = Guid.NewGuid(),
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
