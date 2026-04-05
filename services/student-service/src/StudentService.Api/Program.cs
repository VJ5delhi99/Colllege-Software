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
app.MapGet("/api/v1/students", async (HttpContext httpContext, StudentDbContext db, string? search, string? department, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = db.Students.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(x => x.Name.Contains(search) || x.Email.Contains(search) || x.Batch.Contains(search));
    }

    if (!string.IsNullOrWhiteSpace(department))
    {
        query = query.Where(x => x.Department == department);
    }

    var total = await query.CountAsync();
    var items = await query.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
})
    .RequirePermissions("rbac.manage");
app.MapGet("/api/v1/students/{id:guid}", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Students.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == httpContext.GetValidatedTenantId()) is { } student ? Results.Ok(student) : Results.NotFound())
    .RequirePermissions("rbac.manage");
app.MapGet("/api/v1/students/{id:guid}/profile", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Students.Where(x => x.Id == id && x.TenantId == httpContext.GetValidatedTenantId()).Select(x => new { x.Id, x.Name, x.Department, x.Batch, x.Email, x.AcademicStatus }).FirstOrDefaultAsync() is { } profile ? Results.Ok(profile) : Results.NotFound())
    .RequirePermissions("rbac.manage");
app.MapGet("/api/v1/students/{id:guid}/enrollments", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Enrollments.Where(x => x.StudentId == id && x.TenantId == httpContext.GetValidatedTenantId()).OrderByDescending(x => x.EnrolledAtUtc).ToListAsync())
    .RequirePermissions("results.view");

app.MapGet("/api/v1/students/{id:guid}/workspace", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, id))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var student = await db.Students.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (student is null)
    {
        return Results.NotFound();
    }

    var enrollments = await db.Enrollments
        .Where(x => x.StudentId == id && x.TenantId == tenantId)
        .OrderByDescending(x => x.EnrolledAtUtc)
        .ToListAsync();
    var requests = await db.ServiceRequests
        .Where(x => x.StudentId == id && x.TenantId == tenantId)
        .OrderByDescending(x => x.RequestedAtUtc)
        .ToListAsync();

    return Results.Ok(StudentWorkspaceSummary.Create(student, enrollments, requests));
}).RequireRoles("Student", "Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/students/{id:guid}/requests", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, id))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await db.ServiceRequests
        .Where(x => x.StudentId == id && x.TenantId == tenantId)
        .OrderByDescending(x => x.RequestedAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Student", "Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/students/{id:guid}/requests", async (Guid id, HttpContext httpContext, [FromBody] CreateStudentRequest request, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, id))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.RequestType) || string.IsNullOrWhiteSpace(request.Title))
    {
        return Results.BadRequest(new { message = "Request type and title are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var student = await db.Students.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (student is null)
    {
        return Results.NotFound();
    }

    var serviceRequest = new StudentServiceRequest
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = id,
        RequestType = request.RequestType.Trim(),
        Title = request.Title.Trim(),
        Description = request.Description?.Trim() ?? string.Empty,
        Status = "Submitted",
        RequestedAtUtc = DateTimeOffset.UtcNow
    };

    db.ServiceRequests.Add(serviceRequest);
    db.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "student.request.created",
        EntityId = serviceRequest.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? student.Email,
        Details = $"{serviceRequest.RequestType}:{serviceRequest.Title}",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/students/{id}/requests/{serviceRequest.Id}", serviceRequest);
}).RequireRoles("Student", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/enrollments", async (HttpContext httpContext, [FromBody] EnrollmentRequest request, StudentDbContext db) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var exists = await db.Enrollments.AnyAsync(x =>
        x.TenantId == tenantId &&
        x.StudentId == request.StudentId &&
        x.CourseCode == request.CourseCode &&
        x.SemesterCode == request.SemesterCode);
    if (exists)
    {
        return Results.Conflict(new { message = "Enrollment already exists for this student, course, and semester." });
    }

    var enrollment = new StudentEnrollment
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = request.StudentId,
        CourseCode = request.CourseCode,
        SemesterCode = request.SemesterCode,
        Status = request.Status,
        EnrolledAtUtc = DateTimeOffset.UtcNow
    };

    db.Enrollments.Add(enrollment);
    db.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "student.enrollment.created",
        EntityId = enrollment.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{request.StudentId}:{request.CourseCode}:{request.SemesterCode}",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/enrollments/{enrollment.Id}", enrollment);
}).RequirePermissions("rbac.manage");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, StudentDbContext db, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = db.AuditLogs.Where(x => x.TenantId == tenantId);
    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
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
        db.Enrollments.Add(new StudentEnrollment
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
            CourseCode = "PHY201",
            SemesterCode = "2026-SPRING",
            Status = "Enrolled",
            EnrolledAtUtc = DateTimeOffset.UtcNow.AddDays(-20)
        });
        db.Enrollments.Add(new StudentEnrollment
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
            CourseCode = "MTH301",
            SemesterCode = "2026-SPRING",
            Status = "Enrolled",
            EnrolledAtUtc = DateTimeOffset.UtcNow.AddDays(-20)
        });
    }

    if (!await db.ServiceRequests.AnyAsync())
    {
        db.ServiceRequests.AddRange(
        [
            new StudentServiceRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
                RequestType = "Bonafide Letter",
                Title = "Need bonafide letter for internship verification",
                Description = "Request raised for the internship onboarding packet.",
                Status = "Submitted",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new StudentServiceRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
                RequestType = "Leave Request",
                Title = "Medical leave for lab session",
                Description = "Attendance consideration requested with medical note.",
                Status = "In Review",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            }
        ]);
    }

    await db.SaveChangesAsync();
}

public sealed record EnrollmentRequest(string TenantId, Guid StudentId, string CourseCode, string SemesterCode, string Status);
public sealed record CreateStudentRequest(string TenantId, string RequestType, string Title, string? Description);

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

public sealed class StudentServiceRequest
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public string RequestType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Submitted";
    public DateTimeOffset RequestedAtUtc { get; set; }
}

public sealed class AuditLogEntry
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Action { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class StudentDbContext(DbContextOptions<StudentDbContext> options) : DbContext(options)
{
    public DbSet<StudentRecord> Students => Set<StudentRecord>();
    public DbSet<StudentEnrollment> Enrollments => Set<StudentEnrollment>();
    public DbSet<StudentServiceRequest> ServiceRequests => Set<StudentServiceRequest>();
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
}

public sealed record StudentWorkspaceSummary(
    Guid StudentId,
    string Name,
    string Department,
    string Batch,
    string AcademicStatus,
    int EnrollmentCount,
    int OpenRequests,
    StudentEnrollment[] RecentEnrollments,
    StudentServiceRequest[] RecentRequests)
{
    public static StudentWorkspaceSummary Create(
        StudentRecord student,
        IReadOnlyCollection<StudentEnrollment> enrollments,
        IReadOnlyCollection<StudentServiceRequest> requests) =>
        new(
            student.Id,
            student.Name,
            student.Department,
            student.Batch,
            student.AcademicStatus,
            enrollments.Count,
            requests.Count(item => item.Status == "Submitted" || item.Status == "In Review"),
            enrollments.Take(4).ToArray(),
            requests.Take(4).ToArray());
}

public static class StudentAccessPolicy
{
    public static bool CanAccessStudentWorkspace(HttpContext httpContext, Guid requestedUserId)
    {
        var role = httpContext.User.FindFirst("role")?.Value
            ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
            ?? string.Empty;

        if (new[] { "Professor", "Principal", "Admin", "DepartmentHead" }.Contains(role, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        var currentUserId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.User.FindFirst("sub")?.Value;

        return Guid.TryParse(currentUserId, out var parsedUserId) && parsedUserId == requestedUserId;
    }
}
