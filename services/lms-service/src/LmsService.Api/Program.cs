using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<LmsDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<LmsDbContext>();
await SeedAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "lms-service", status = "ready", storage = "signed-url" }));

app.MapGet("/api/v1/materials", async (HttpContext httpContext, LmsDbContext dbContext) =>
    await dbContext.Materials.Where(x => x.TenantId == httpContext.GetTenantId()).ToListAsync())
    .RequirePermissions("results.view");

app.MapGet("/api/v1/assignments", async (HttpContext httpContext, LmsDbContext dbContext) =>
    await dbContext.Assignments.Where(x => x.TenantId == httpContext.GetTenantId()).ToListAsync())
    .RequirePermissions("results.view");

app.MapPost("/api/v1/materials/upload-request", async ([FromBody] UploadRequest request, IObjectStorageService storage, LmsDbContext dbContext) =>
{
    var objectKey = $"{request.TenantId}/materials/{Guid.NewGuid():N}-{request.FileName}";
    var signedUrl = await storage.CreateUploadUrlAsync("university360-materials", objectKey, request.ContentType, TimeSpan.FromMinutes(15));
    var material = new CourseMaterial
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        CourseCode = request.CourseCode,
        Title = request.Title,
        ObjectKey = objectKey,
        FileName = request.FileName
    };

    dbContext.Materials.Add(material);
    await dbContext.SaveChangesAsync();
    return Results.Ok(new { material.Id, upload = signedUrl });
}).RequirePermissions("files.upload");

app.MapPost("/api/v1/assignments/upload-request", async ([FromBody] UploadRequest request, IObjectStorageService storage, LmsDbContext dbContext) =>
{
    var objectKey = $"{request.TenantId}/assignments/{Guid.NewGuid():N}-{request.FileName}";
    var signedUrl = await storage.CreateUploadUrlAsync("university360-assignments", objectKey, request.ContentType, TimeSpan.FromMinutes(15));
    var assignment = new AssignmentItem
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Title = request.Title,
        FileName = request.FileName,
        ObjectKey = objectKey,
        UploadedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.Assignments.Add(assignment);
    await dbContext.SaveChangesAsync();
    return Results.Ok(new { assignment.Id, upload = signedUrl });
}).RequirePermissions("files.upload");

app.MapGet("/api/v1/materials/{id:guid}/download-url", async (Guid id, HttpContext httpContext, IObjectStorageService storage, LmsDbContext dbContext) =>
{
    var material = await dbContext.Materials.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == httpContext.GetTenantId());
    if (material is null)
    {
        return Results.NotFound();
    }

    var signedUrl = await storage.CreateDownloadUrlAsync("university360-materials", material.ObjectKey, TimeSpan.FromMinutes(30));
    return Results.Ok(signedUrl);
}).RequirePermissions("results.view");

app.Run();

static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<LmsDbContext>();
    if (await dbContext.Materials.AnyAsync())
    {
        return;
    }

    dbContext.Materials.Add(new CourseMaterial { Id = Guid.NewGuid(), TenantId = "default", CourseCode = "CSE401", Title = "Week 1 Slides", FileName = "week1-slides.pdf", ObjectKey = "default/materials/week1-slides.pdf" });
    dbContext.Assignments.Add(new AssignmentItem { Id = Guid.NewGuid(), TenantId = "default", Title = "Distributed Systems Lab 1", FileName = "lab1.pdf", ObjectKey = "default/assignments/lab1.pdf", UploadedAtUtc = DateTimeOffset.UtcNow.AddDays(-3) });
    await dbContext.SaveChangesAsync();
}

public sealed record UploadRequest(string TenantId, string CourseCode, string Title, string FileName, string ContentType);

public sealed class CourseMaterial
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string CourseCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
}

public sealed class AssignmentItem
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Title { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public DateTimeOffset UploadedAtUtc { get; set; }
}

public sealed class LmsDbContext(DbContextOptions<LmsDbContext> options) : DbContext(options)
{
    public DbSet<CourseMaterial> Materials => Set<CourseMaterial>();
    public DbSet<AssignmentItem> Assignments => Set<AssignmentItem>();
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}
