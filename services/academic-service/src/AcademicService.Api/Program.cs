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
    var tenantId = httpContext.GetValidatedTenantId();
    var course = new Course
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
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
    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.course.created", course.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"Course {course.CourseCode} created for {course.SemesterCode}."));
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

app.MapGet("/api/v1/teachers/{teacherId:guid}/summary", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var courses = await dbContext.Courses
        .Where(x => x.TenantId == tenantId && x.FacultyId == teacherId)
        .OrderBy(x => x.DayOfWeek)
        .ThenBy(x => x.StartTime)
        .ToListAsync();

    return Results.Ok(new
    {
        totalCourses = courses.Count,
        nextCourse = courses.FirstOrDefault(),
        teachingLoad = courses.Select(x => x.CourseCode).Distinct().Count()
    });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/public/homepage", async (AcademicDbContext dbContext, string tenantId = "default") =>
{
    var colleges = await dbContext.Colleges.Where(x => x.TenantId == tenantId).OrderBy(x => x.Name).ToListAsync();
    var campuses = await dbContext.Campuses.Where(x => x.TenantId == tenantId).OrderBy(x => x.Name).ToListAsync();
    var programs = await dbContext.Programs.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.IsFeatured).ThenBy(x => x.Name).ToListAsync();

    return Results.Ok(new
    {
        stats = new[]
        {
            new { label = "Colleges", value = colleges.Count.ToString("N0") },
            new { label = "Campuses", value = campuses.Count.ToString("N0") },
            new { label = "Programs", value = programs.Count.ToString("N0") },
            new { label = "Student Capacity", value = campuses.Sum(x => x.StudentCapacity).ToString("N0") }
        },
        colleges = colleges.Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.DeanName,
            x.City,
            x.CampusCount,
            x.StudentCount
        }),
        campuses = campuses.Select(x => new
        {
            x.Id,
            x.CollegeId,
            x.Code,
            x.Name,
            location = $"{x.City}, {x.State}",
            x.City,
            x.State,
            x.Description,
            image = x.ImagePath,
            statLabel = x.HighlightMetricLabel,
            statValue = x.HighlightMetricValue.ToString("N0"),
            x.StudentCapacity,
            x.FacultyCount,
            facilities = SplitList(x.Facilities)
        }),
        featuredPrograms = programs.Where(x => x.IsFeatured).Take(6).Select(x => new
        {
            x.Id,
            x.CampusId,
            x.Code,
            x.Name,
            x.LevelName,
            x.DepartmentName,
            x.DurationYears,
            x.Seats,
            mode = x.ModeName,
            x.Description,
            x.CareerPath
        }),
        campusOptions = campuses.Select(x => new { x.Id, x.Name }),
        levelOptions = programs.Select(x => x.LevelName).Distinct().OrderBy(x => x)
    });
});

app.MapGet("/api/v1/public/programs", async (AcademicDbContext dbContext, string tenantId = "default", string? search = null, Guid? campusId = null, string? level = null) =>
{
    var query = dbContext.Programs.Where(x => x.TenantId == tenantId);

    if (campusId.HasValue)
    {
        query = query.Where(x => x.CampusId == campusId.Value);
    }

    if (!string.IsNullOrWhiteSpace(level))
    {
        query = query.Where(x => x.LevelName == level);
    }

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(x =>
            x.Name.Contains(search) ||
            x.Code.Contains(search) ||
            x.DepartmentName.Contains(search) ||
            x.Description.Contains(search) ||
            x.CareerPath.Contains(search));
    }

    var items = await query.OrderByDescending(x => x.IsFeatured).ThenBy(x => x.Name).Take(24).ToListAsync();
    return Results.Ok(items.Select(x => new
    {
        x.Id,
        x.CampusId,
        x.Code,
        x.Name,
        x.LevelName,
        x.DepartmentName,
        x.DurationYears,
        x.Seats,
        mode = x.ModeName,
        x.Description,
        x.CareerPath,
        x.IsFeatured
    }));
});

app.MapGet("/api/v1/catalog/summary", async (HttpContext httpContext, AcademicDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var campuses = await dbContext.Campuses.Where(x => x.TenantId == tenantId).ToListAsync();
    var programs = await dbContext.Programs.Where(x => x.TenantId == tenantId).ToListAsync();

    return Results.Ok(new
    {
        colleges = await dbContext.Colleges.CountAsync(x => x.TenantId == tenantId),
        campuses = campuses.Count,
        programs = programs.Count,
        studentCapacity = campuses.Sum(x => x.StudentCapacity),
        facultyCount = campuses.Sum(x => x.FacultyCount),
        featuredPrograms = programs.Count(x => x.IsFeatured)
    });
}).RequirePermissions("results.view");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, AcademicDbContext dbContext, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.AuditLogs.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.CreatedAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { items, page = safePage, pageSize = safePageSize, total });
}).RequirePermissions("results.view");

app.Run();

static async Task SeedAcademicDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AcademicDbContext>();

    if (!await dbContext.Courses.AnyAsync())
    {
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
    }

    if (!await dbContext.Colleges.AnyAsync())
    {
        var engineeringCollegeId = Guid.NewGuid();
        var liberalArtsCollegeId = Guid.NewGuid();
        var healthCollegeId = Guid.NewGuid();
        var northCampusId = Guid.NewGuid();
        var heritageCampusId = Guid.NewGuid();
        var healthCampusId = Guid.NewGuid();

        dbContext.Colleges.AddRange(
        [
            new CollegeProfile
            {
                Id = engineeringCollegeId,
                TenantId = "default",
                Code = "U360-ENG",
                Name = "School of Engineering and Digital Systems",
                DeanName = "Dr. Meera Nair",
                City = "Bengaluru",
                CampusCount = 1,
                StudentCount = 8200
            },
            new CollegeProfile
            {
                Id = liberalArtsCollegeId,
                TenantId = "default",
                Code = "U360-ARTS",
                Name = "College of Arts, Media, and Commerce",
                DeanName = "Dr. Arjun Patel",
                City = "Mysuru",
                CampusCount = 1,
                StudentCount = 5400
            },
            new CollegeProfile
            {
                Id = healthCollegeId,
                TenantId = "default",
                Code = "U360-HLTH",
                Name = "Institute of Health and Applied Sciences",
                DeanName = "Dr. Kavya Iyer",
                City = "Chennai",
                CampusCount = 1,
                StudentCount = 4300
            }
        ]);

        dbContext.Campuses.AddRange(
        [
            new CampusProfile
            {
                Id = northCampusId,
                TenantId = "default",
                CollegeId = engineeringCollegeId,
                Code = "BLR-NORTH",
                Name = "North City Campus",
                City = "Bengaluru",
                State = "Karnataka",
                Description = "A technology-led campus with applied AI labs, startup incubation support, and strong industry-linked engineering delivery.",
                ImagePath = "/images/graduation-hero.svg",
                StudentCapacity = 6200,
                FacultyCount = 340,
                HighlightMetricLabel = "Live Labs",
                HighlightMetricValue = 19,
                Facilities = "Innovation hub,Cloud lab,Maker space,Startup cell"
            },
            new CampusProfile
            {
                Id = heritageCampusId,
                TenantId = "default",
                CollegeId = liberalArtsCollegeId,
                Code = "MYS-HERITAGE",
                Name = "Heritage Arts Campus",
                City = "Mysuru",
                State = "Karnataka",
                Description = "Designed for liberal arts, commerce, media, and interdisciplinary collaboration with a calmer academic atmosphere and strong cultural programming.",
                ImagePath = "/images/student-spotlight.svg",
                StudentCapacity = 4100,
                FacultyCount = 210,
                HighlightMetricLabel = "Studios",
                HighlightMetricValue = 11,
                Facilities = "Media studio,Design workshop,Library commons,Language lab"
            },
            new CampusProfile
            {
                Id = healthCampusId,
                TenantId = "default",
                CollegeId = healthCollegeId,
                Code = "CHE-HEALTH",
                Name = "Health Sciences Campus",
                City = "Chennai",
                State = "Tamil Nadu",
                Description = "A simulation-ready campus for allied health, biosciences, and community practice with clinical readiness spaces.",
                ImagePath = "/images/graduation-hero.svg",
                StudentCapacity = 3600,
                FacultyCount = 185,
                HighlightMetricLabel = "Clinical Suites",
                HighlightMetricValue = 8,
                Facilities = "Simulation ward,Anatomy lab,Community clinic,Research wet lab"
            }
        ]);

        dbContext.Programs.AddRange(
        [
            new AcademicProgramProfile
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CampusId = northCampusId,
                Code = "BTECH-CSE",
                Name = "B.Tech Computer Science and Engineering",
                LevelName = "Undergraduate",
                DepartmentName = "Computer Science",
                DurationYears = 4,
                Seats = 240,
                ModeName = "Full Time",
                IsFeatured = true,
                Description = "A project-heavy engineering pathway focused on software delivery, distributed systems, and AI fundamentals.",
                CareerPath = "Software engineering, cloud, platform, and AI product teams"
            },
            new AcademicProgramProfile
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CampusId = northCampusId,
                Code = "MTECH-DS",
                Name = "M.Tech Data Science",
                LevelName = "Postgraduate",
                DepartmentName = "Data Science",
                DurationYears = 2,
                Seats = 60,
                ModeName = "Full Time",
                IsFeatured = true,
                Description = "Advanced analytics, applied machine learning, and production data engineering with an industry project studio.",
                CareerPath = "Data science, MLOps, research, analytics leadership"
            },
            new AcademicProgramProfile
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CampusId = heritageCampusId,
                Code = "BBA-DM",
                Name = "BBA Digital Management",
                LevelName = "Undergraduate",
                DepartmentName = "Management Studies",
                DurationYears = 3,
                Seats = 180,
                ModeName = "Full Time",
                IsFeatured = true,
                Description = "Business fundamentals, digital operations, and communication design for modern enterprise teams.",
                CareerPath = "Operations, product support, digital business, consulting"
            },
            new AcademicProgramProfile
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CampusId = heritageCampusId,
                Code = "BA-MEDIA",
                Name = "BA Media and Communication",
                LevelName = "Undergraduate",
                DepartmentName = "Media Studies",
                DurationYears = 3,
                Seats = 120,
                ModeName = "Full Time",
                IsFeatured = false,
                Description = "Editorial storytelling, campus production, and digital publishing grounded in applied communication practice.",
                CareerPath = "Content, media production, communication strategy"
            },
            new AcademicProgramProfile
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CampusId = healthCampusId,
                Code = "BSC-ALLIED",
                Name = "B.Sc Allied Health Sciences",
                LevelName = "Undergraduate",
                DepartmentName = "Allied Health",
                DurationYears = 4,
                Seats = 150,
                ModeName = "Full Time",
                IsFeatured = true,
                Description = "Clinical readiness, diagnostics, and community health practice supported by simulation-led instruction.",
                CareerPath = "Hospitals, diagnostics, community health, clinical support"
            },
            new AcademicProgramProfile
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CampusId = healthCampusId,
                Code = "MSC-BIO",
                Name = "M.Sc Biosciences",
                LevelName = "Postgraduate",
                DepartmentName = "Biosciences",
                DurationYears = 2,
                Seats = 48,
                ModeName = "Full Time",
                IsFeatured = false,
                Description = "Research-led bioscience study with translational lab work and faculty-supervised capstone projects.",
                CareerPath = "Research labs, biotech, higher studies"
            }
        ]);
    }

    await dbContext.SaveChangesAsync();
}

static string[] SplitList(string value) =>
    value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

static bool CanAccessSubject(HttpContext httpContext, Guid requestedUserId, params string[] elevatedRoles)
{
    var role = httpContext.User.FindFirst("role")?.Value
        ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
        ?? string.Empty;

    if (elevatedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
    {
        return true;
    }

    var currentUserId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? httpContext.User.FindFirst("sub")?.Value;

    return Guid.TryParse(currentUserId, out var parsedUserId) && parsedUserId == requestedUserId;
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

public sealed class CollegeProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string DeanName { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public int CampusCount { get; set; }
    public int StudentCount { get; set; }
}

public sealed class CampusProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CollegeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ImagePath { get; set; } = "/images/graduation-hero.svg";
    public int StudentCapacity { get; set; }
    public int FacultyCount { get; set; }
    public string HighlightMetricLabel { get; set; } = "Programs";
    public int HighlightMetricValue { get; set; }
    public string Facilities { get; set; } = string.Empty;
}

public sealed class AcademicProgramProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CampusId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string LevelName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public int DurationYears { get; set; }
    public int Seats { get; set; }
    public string ModeName { get; set; } = "Full Time";
    public bool IsFeatured { get; set; }
    public string Description { get; set; } = string.Empty;
    public string CareerPath { get; set; } = string.Empty;
}

public sealed class AcademicAuditLog
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Action { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    public static AcademicAuditLog Create(string tenantId, string action, string entityId, string actor, string details) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Action = action,
            EntityId = entityId,
            Actor = actor,
            Details = details,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
}

public sealed class AcademicDbContext(DbContextOptions<AcademicDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<CollegeProfile> Colleges => Set<CollegeProfile>();
    public DbSet<CampusProfile> Campuses => Set<CampusProfile>();
    public DbSet<AcademicProgramProfile> Programs => Set<AcademicProgramProfile>();
    public DbSet<AcademicAuditLog> AuditLogs => Set<AcademicAuditLog>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
    public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999");
}
