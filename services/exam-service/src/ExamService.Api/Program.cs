using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<ExamDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await SeedExamDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "exam-service", security = "publish-control-enabled" }));

app.MapPost("/api/v1/results", async ([FromBody] PublishResultRequest request, ExamDbContext dbContext) =>
{
    var result = new StudentResult
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        StudentId = request.StudentId,
        SemesterCode = request.SemesterCode,
        Gpa = request.Gpa,
        Published = request.Published,
        PublishedAtUtc = request.Published ? DateTimeOffset.UtcNow : null
    };

    dbContext.StudentResults.Add(result);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/results/{result.Id}", result);
}).RequireRateLimiting("api");

app.MapGet("/api/v1/results", async (HttpContext httpContext, ExamDbContext dbContext) =>
    await dbContext.StudentResults.Where(x => x.TenantId == httpContext.GetTenantId()).OrderByDescending(x => x.PublishedAtUtc).ToListAsync());

app.MapGet("/api/v1/results/{studentId:guid}", async (Guid studentId, HttpContext httpContext, ExamDbContext dbContext) =>
    await dbContext.StudentResults.Where(x => x.TenantId == httpContext.GetTenantId() && x.StudentId == studentId).OrderByDescending(x => x.PublishedAtUtc).ToListAsync());

app.MapGet("/api/v1/results/summary", async (HttpContext httpContext, ExamDbContext dbContext) =>
{
    var tenantId = httpContext.GetTenantId();
    var published = await dbContext.StudentResults.Where(x => x.TenantId == tenantId && x.Published).ToListAsync();
    return Results.Ok(new
    {
        totalPublished = published.Count,
        averageGpa = published.Count == 0 ? 0 : Math.Round(published.Average(x => x.Gpa), 2),
        latest = published.OrderByDescending(x => x.PublishedAtUtc).FirstOrDefault()
    });
});

app.Run();

static async Task SeedExamDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ExamDbContext>();
    await dbContext.Database.EnsureCreatedAsync();

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

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public sealed class ExamDbContext(DbContextOptions<ExamDbContext> options) : DbContext(options)
{
    public DbSet<StudentResult> StudentResults => Set<StudentResult>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
}
