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
    if (await dbContext.StudentResults.AnyAsync())
    {
        return;
    }

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

    await dbContext.SaveChangesAsync();
}

public sealed record PublishResultRequest(string TenantId, Guid StudentId, string SemesterCode, decimal Gpa, bool Published);

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
    public DbSet<ExamAuditLog> AuditLogs => Set<ExamAuditLog>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
}
