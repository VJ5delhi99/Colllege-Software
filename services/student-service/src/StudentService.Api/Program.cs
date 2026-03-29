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
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
}
