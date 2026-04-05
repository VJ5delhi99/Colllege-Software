using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<ExamDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<ExamDbContext>();
await SeedExamDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "exam-service", security = "publish-control-enabled" }));

app.MapPost("/api/v1/results", async (HttpContext httpContext, [FromBody] PublishResultRequest request, ExamDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var result = new StudentResult
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = request.StudentId,
        SemesterCode = request.SemesterCode,
        Gpa = request.Gpa,
        Published = request.Published,
        PublishedAtUtc = request.Published ? DateTimeOffset.UtcNow : null
    };

    dbContext.StudentResults.Add(result);
    dbContext.AuditLogs.Add(ExamAuditLog.Create(tenantId, "exam.result.published", result.Id.ToString(), httpContext.User.Identity?.Name ?? "exam-service", $"Result recorded for semester {result.SemesterCode} with GPA {result.Gpa}."));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/results/{result.Id}", result);
}).RequirePermissions("results.publish").RequireRateLimiting("api");

app.MapGet("/api/v1/results", async (HttpContext httpContext, ExamDbContext dbContext, Guid? studentId, string? semesterCode, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.StudentResults.Where(x => x.TenantId == tenantId);

    if (studentId.HasValue)
    {
        query = query.Where(x => x.StudentId == studentId.Value);
    }

    if (!string.IsNullOrWhiteSpace(semesterCode))
    {
        query = query.Where(x => x.SemesterCode == semesterCode);
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.PublishedAtUtc).Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { items, page = safePage, pageSize = safePageSize, total });
})
    .RequirePermissions("results.view");

app.MapGet("/api/v1/results/{studentId:guid}", async (Guid studentId, HttpContext httpContext, ExamDbContext dbContext) =>
    await dbContext.StudentResults.Where(x => x.TenantId == httpContext.GetValidatedTenantId() && x.StudentId == studentId).OrderByDescending(x => x.PublishedAtUtc).ToListAsync())
    .RequirePermissions("results.view");

app.MapGet("/api/v1/results/summary", async (HttpContext httpContext, ExamDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var published = await dbContext.StudentResults.Where(x => x.TenantId == tenantId && x.Published).ToListAsync();
    return Results.Ok(new
    {
        totalPublished = published.Count,
        averageGpa = published.Count == 0 ? 0 : Math.Round(published.Average(x => x.Gpa), 2),
        latest = published.OrderByDescending(x => x.PublishedAtUtc).FirstOrDefault()
    });
}).RequirePermissions("results.view");

app.MapGet("/api/v1/students/{studentId:guid}/summary", async (Guid studentId, HttpContext httpContext, ExamDbContext dbContext) =>
{
    if (!CanAccessStudentRecord(httpContext, studentId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var published = await dbContext.StudentResults
        .Where(x => x.TenantId == tenantId && x.StudentId == studentId && x.Published)
        .OrderByDescending(x => x.PublishedAtUtc)
        .ToListAsync();

    return Results.Ok(new
    {
        totalPublished = published.Count,
        averageGpa = published.Count == 0 ? 0 : Math.Round(published.Average(x => x.Gpa), 2),
        latest = published.FirstOrDefault()
    });
}).RequireRoles("Student", "Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/grading-summary", async (Guid teacherId, HttpContext httpContext, ExamDbContext dbContext) =>
{
    if (!CanAccessTeacherWorkspace(httpContext, teacherId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.GradeReviews
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderByDescending(x => x.CreatedAtUtc)
        .ToListAsync();
    return Results.Ok(GradeReviewSummary.Create(items));
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/publishing-queue", async (Guid teacherId, HttpContext httpContext, ExamDbContext dbContext) =>
{
    if (!CanAccessTeacherWorkspace(httpContext, teacherId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.AssessmentPublications
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderByDescending(x => x.UpdatedAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/publishing-queue/{id:guid}/status", async (Guid teacherId, Guid id, HttpContext httpContext, [FromBody] UpdateAssessmentPublicationStatusRequest request, ExamDbContext dbContext) =>
{
    if (!CanAccessTeacherWorkspace(httpContext, teacherId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.AssessmentPublications.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.TeacherId == teacherId);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status.Trim();
    item.ModerationNote = request.ModerationNote?.Trim() ?? item.ModerationNote;
    item.PublishedAtUtc = string.Equals(item.Status, "Published", StringComparison.OrdinalIgnoreCase) ? DateTimeOffset.UtcNow : item.PublishedAtUtc;
    item.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(ExamAuditLog.Create(tenantId, "exam.assessment-publication.status-updated", item.Id.ToString(), httpContext.User.Identity?.Name ?? "exam-service", $"{item.CourseCode}:{item.AssessmentName}:{item.Status}"));
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/grade-reviews/{id:guid}/status", async (Guid teacherId, Guid id, HttpContext httpContext, [FromBody] UpdateGradeReviewStatusRequest request, ExamDbContext dbContext) =>
{
    if (!CanAccessTeacherWorkspace(httpContext, teacherId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var review = await dbContext.GradeReviews.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.TeacherId == teacherId);
    if (review is null)
    {
        return Results.NotFound();
    }

    review.Status = request.Status.Trim();
    review.ReviewerNote = request.ReviewerNote?.Trim() ?? review.ReviewerNote;
    review.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(ExamAuditLog.Create(tenantId, "exam.grade-review.status-updated", review.Id.ToString(), httpContext.User.Identity?.Name ?? "exam-service", $"{review.CourseCode}:{review.Status}"));
    await dbContext.SaveChangesAsync();
    return Results.Ok(review);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, ExamDbContext dbContext, int page = 1, int pageSize = 20) =>
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

static async Task SeedExamDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ExamDbContext>();

    if (!await dbContext.StudentResults.AnyAsync())
    {
        dbContext.StudentResults.AddRange(
        [
            new StudentResult
            {
                TenantId = "default",
                Id = Guid.NewGuid(),
                StudentId = KnownUsers.StudentId,
                SemesterCode = "2025-FALL",
                Gpa = 8.7m,
                Published = true,
                PublishedAtUtc = DateTimeOffset.UtcNow.AddDays(-120)
            },
            new StudentResult
            {
                TenantId = "default",
                Id = Guid.NewGuid(),
                StudentId = KnownUsers.StudentId,
                SemesterCode = "2026-SPRING",
                Gpa = 8.9m,
                Published = true,
                PublishedAtUtc = DateTimeOffset.UtcNow.AddDays(-10)
            }
        ]);
    }

    if (!await dbContext.GradeReviews.AnyAsync())
    {
        dbContext.GradeReviews.AddRange(
        [
            new GradeReviewItem
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                StudentName = "Aarav Sharma",
                CourseCode = "CSE401",
                AssessmentName = "Lab Evaluation 1",
                Status = "Pending Review",
                ReviewerNote = "Need to double-check the replication diagram rubric.",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new GradeReviewItem
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                StudentName = "Aarav Sharma",
                CourseCode = "PHY201",
                AssessmentName = "Internal Quiz 2",
                Status = "Ready To Publish",
                ReviewerNote = "Moderation completed.",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            }
        ]);
    }

    if (!await dbContext.AssessmentPublications.AnyAsync())
    {
        dbContext.AssessmentPublications.AddRange(
        [
            new AssessmentPublicationItem
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "CSE401",
                AssessmentName = "Midterm Rubric",
                Status = "Moderation Review",
                ModerationNote = "Waiting for final rubric sign-off.",
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            },
            new AssessmentPublicationItem
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "PHY201",
                AssessmentName = "Internal Quiz 2",
                Status = "Ready To Publish",
                ModerationNote = "Moderation completed and board-ready.",
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-6)
            }
        ]);
    }

    await dbContext.SaveChangesAsync();
}

static bool CanAccessStudentRecord(HttpContext httpContext, Guid requestedUserId, params string[] elevatedRoles)
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

static bool CanAccessTeacherWorkspace(HttpContext httpContext, Guid requestedUserId)
{
    var role = httpContext.User.FindFirst("role")?.Value
        ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
        ?? string.Empty;

    if (new[] { "Principal", "Admin", "DepartmentHead" }.Contains(role, StringComparer.OrdinalIgnoreCase))
    {
        return true;
    }

    var currentUserId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? httpContext.User.FindFirst("sub")?.Value;

    return Guid.TryParse(currentUserId, out var parsedUserId) && parsedUserId == requestedUserId;
}

public sealed record PublishResultRequest(string TenantId, Guid StudentId, string SemesterCode, decimal Gpa, bool Published);
public sealed record UpdateGradeReviewStatusRequest(string Status, string? ReviewerNote);
public sealed record UpdateAssessmentPublicationStatusRequest(string Status, string? ModerationNote);
public sealed record GradeReviewSummary(
    int Total,
    int Pending,
    int ReadyToPublish,
    int Published,
    GradeReviewItem[] Items)
{
    public static GradeReviewSummary Create(IReadOnlyCollection<GradeReviewItem> items) =>
        new(
            items.Count,
            items.Count(item => item.Status == "Pending Review"),
            items.Count(item => item.Status == "Ready To Publish"),
            items.Count(item => item.Status == "Published"),
            items.ToArray());
}

public sealed class StudentResult
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public string SemesterCode { get; set; } = string.Empty;
    public decimal Gpa { get; set; }
    public bool Published { get; set; }
    public DateTimeOffset? PublishedAtUtc { get; set; }
}

public sealed class GradeReviewItem
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
    public string AssessmentName { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Review";
    public string ReviewerNote { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class AssessmentPublicationItem
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public string AssessmentName { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft";
    public string ModerationNote { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? PublishedAtUtc { get; set; }
}

public sealed class ExamAuditLog
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Action { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    public static ExamAuditLog Create(string tenantId, string action, string entityId, string actor, string details) =>
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

public sealed class ExamDbContext(DbContextOptions<ExamDbContext> options) : DbContext(options)
{
    public DbSet<StudentResult> StudentResults => Set<StudentResult>();
    public DbSet<GradeReviewItem> GradeReviews => Set<GradeReviewItem>();
    public DbSet<AssessmentPublicationItem> AssessmentPublications => Set<AssessmentPublicationItem>();
    public DbSet<ExamAuditLog> AuditLogs => Set<ExamAuditLog>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
}
