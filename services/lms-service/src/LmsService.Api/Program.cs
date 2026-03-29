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
    await dbContext.Materials.Where(x => x.TenantId == httpContext.GetValidatedTenantId()).ToListAsync())
    .RequirePermissions("results.view");

app.MapGet("/api/v1/assignments", async (HttpContext httpContext, LmsDbContext dbContext) =>
    await dbContext.Assignments.Where(x => x.TenantId == httpContext.GetValidatedTenantId()).ToListAsync())
    .RequirePermissions("results.view");

app.MapPost("/api/v1/materials/upload-request", async (HttpContext httpContext, [FromBody] UploadRequest request, IObjectStorageService storage, LmsDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    if (!IsAllowedContentType(request.ContentType))
    {
        return Results.BadRequest(new { message = "Unsupported file type." });
    }

    var safeFileName = SanitizeFileName(request.FileName);
    var objectKey = $"{httpContext.GetValidatedTenantId()}/materials/{Guid.NewGuid():N}-{safeFileName}";
    var signedUrl = await storage.CreateUploadUrlAsync("university360-materials", objectKey, request.ContentType, TimeSpan.FromMinutes(15));
    var material = new CourseMaterial
    {
        Id = Guid.NewGuid(),
        TenantId = httpContext.GetValidatedTenantId(),
        CourseCode = request.CourseCode,
        Title = request.Title,
        ObjectKey = objectKey,
        FileName = safeFileName
    };

    dbContext.Materials.Add(material);
    await dbContext.SaveChangesAsync();
    return Results.Ok(new { material.Id, upload = signedUrl });
}).RequirePermissions("files.upload");

app.MapPost("/api/v1/assignments/upload-request", async (HttpContext httpContext, [FromBody] UploadRequest request, IObjectStorageService storage, LmsDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    if (!IsAllowedContentType(request.ContentType))
    {
        return Results.BadRequest(new { message = "Unsupported file type." });
    }

    var safeFileName = SanitizeFileName(request.FileName);
    var objectKey = $"{httpContext.GetValidatedTenantId()}/assignments/{Guid.NewGuid():N}-{safeFileName}";
    var signedUrl = await storage.CreateUploadUrlAsync("university360-assignments", objectKey, request.ContentType, TimeSpan.FromMinutes(15));
    var assignment = new AssignmentItem
    {
        Id = Guid.NewGuid(),
        TenantId = httpContext.GetValidatedTenantId(),
        Title = request.Title,
        FileName = safeFileName,
        ObjectKey = objectKey,
        UploadedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.Assignments.Add(assignment);
    await dbContext.SaveChangesAsync();
    return Results.Ok(new { assignment.Id, upload = signedUrl });
}).RequirePermissions("files.upload");

app.MapGet("/api/v1/materials/{id:guid}/download-url", async (Guid id, HttpContext httpContext, IObjectStorageService storage, LmsDbContext dbContext) =>
{
    var material = await dbContext.Materials.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == httpContext.GetValidatedTenantId());
    if (material is null)
    {
        return Results.NotFound();
    }

    var signedUrl = await storage.CreateDownloadUrlAsync("university360-materials", material.ObjectKey, TimeSpan.FromMinutes(30));
    return Results.Ok(signedUrl);
}).RequirePermissions("results.view");

app.MapPost("/api/v1/files/{objectKey}/scan", async (string objectKey, LmsDbContext dbContext) =>
{
    var scan = new FileScanRecord
    {
        Id = Guid.NewGuid(),
        ObjectKey = objectKey,
        Scanner = "clamav-boundary",
        Status = "PendingReview",
        ScannedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.FileScans.Add(scan);
    await dbContext.SaveChangesAsync();
    return Results.Accepted($"/api/v1/files/{Uri.EscapeDataString(objectKey)}/scan", scan);
}).RequirePermissions("files.upload");

app.MapGet("/api/v1/files/scans", async (LmsDbContext dbContext) =>
    await dbContext.FileScans.OrderByDescending(x => x.ScannedAtUtc).ToListAsync())
    .RequirePermissions("files.upload");

app.MapGet("/api/v1/storage/lifecycle-policies", async (LmsDbContext dbContext) =>
    await dbContext.LifecyclePolicies.OrderBy(x => x.Bucket).ToListAsync())
    .RequirePermissions("files.upload");

app.MapPost("/api/v1/storage/lifecycle-policies", async ([FromBody] LifecyclePolicyRequest request, LmsDbContext dbContext) =>
{
    var policy = new StorageLifecyclePolicy
    {
        Id = Guid.NewGuid(),
        Bucket = request.Bucket,
        Prefix = request.Prefix,
        RetentionDays = request.RetentionDays,
        ArchiveAfterDays = request.ArchiveAfterDays
    };

    dbContext.LifecyclePolicies.Add(policy);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/storage/lifecycle-policies/{policy.Id}", policy);
}).RequirePermissions("files.upload");

app.Run();

static bool IsAllowedContentType(string contentType) =>
    contentType is
        "application/pdf" or
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" or
        "image/jpeg" or
        "image/png" or
        "text/plain";

static string SanitizeFileName(string fileName)
{
    var invalidChars = Path.GetInvalidFileNameChars();
    var sanitized = new string(fileName.Where(ch => !invalidChars.Contains(ch)).ToArray()).Trim();
    return string.IsNullOrWhiteSpace(sanitized) ? "upload.bin" : sanitized.Replace(' ', '-');
}

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
    dbContext.LifecyclePolicies.Add(new StorageLifecyclePolicy { Id = Guid.NewGuid(), Bucket = "university360-materials", Prefix = "default/materials/", RetentionDays = 365, ArchiveAfterDays = 90 });
    await dbContext.SaveChangesAsync();
}

public sealed record UploadRequest(string TenantId, string CourseCode, string Title, string FileName, string ContentType);
public sealed record LifecyclePolicyRequest(string Bucket, string Prefix, int RetentionDays, int ArchiveAfterDays);

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

public sealed class FileScanRecord
{
    public Guid Id { get; set; }
    public string ObjectKey { get; set; } = string.Empty;
    public string Scanner { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTimeOffset ScannedAtUtc { get; set; }
}

public sealed class StorageLifecyclePolicy
{
    public Guid Id { get; set; }
    public string Bucket { get; set; } = string.Empty;
    public string Prefix { get; set; } = string.Empty;
    public int RetentionDays { get; set; }
    public int ArchiveAfterDays { get; set; }
}

public sealed class LmsDbContext(DbContextOptions<LmsDbContext> options) : DbContext(options)
{
    public DbSet<CourseMaterial> Materials => Set<CourseMaterial>();
    public DbSet<AssignmentItem> Assignments => Set<AssignmentItem>();
    public DbSet<FileScanRecord> FileScans => Set<FileScanRecord>();
    public DbSet<StorageLifecyclePolicy> LifecyclePolicies => Set<StorageLifecyclePolicy>();
}
