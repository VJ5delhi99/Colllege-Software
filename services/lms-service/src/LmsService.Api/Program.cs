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

app.MapGet("/api/v1/materials", async (HttpContext httpContext, LmsDbContext dbContext, string? courseCode) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var query = dbContext.Materials.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(courseCode))
    {
        query = query.Where(x => x.CourseCode == courseCode);
    }

    return Results.Ok(await query.OrderByDescending(x => x.CreatedAtUtc).ToListAsync());
})
    .RequirePermissions("results.view");

app.MapGet("/api/v1/assignments", async (HttpContext httpContext, LmsDbContext dbContext, string? courseCode) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var query = dbContext.Assignments.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(courseCode))
    {
        query = query.Where(x => x.CourseCode == courseCode);
    }

    return Results.Ok(await query.OrderByDescending(x => x.UploadedAtUtc).ToListAsync());
})
    .RequirePermissions("results.view");

app.MapGet("/api/v1/workspace/summary", async (HttpContext httpContext, LmsDbContext dbContext, string? courseCodes) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var filters = SplitList(courseCodes);
    var materialQuery = dbContext.Materials.Where(x => x.TenantId == tenantId);
    var assignmentQuery = dbContext.Assignments.Where(x => x.TenantId == tenantId);

    if (filters.Length > 0)
    {
        materialQuery = materialQuery.Where(x => filters.Contains(x.CourseCode));
        assignmentQuery = assignmentQuery.Where(x => filters.Contains(x.CourseCode));
    }

    var materials = await materialQuery.OrderByDescending(x => x.CreatedAtUtc).ToListAsync();
    var assignments = await assignmentQuery.OrderByDescending(x => x.UploadedAtUtc).ToListAsync();
    return Results.Ok(new
    {
        materials = materials.Count,
        assignments = assignments.Count,
        latestMaterial = materials.FirstOrDefault(),
        latestAssignment = assignments.FirstOrDefault()
    });
}).RequirePermissions("results.view");

app.MapGet("/api/v1/teachers/{teacherId:guid}/content-drafts", async (Guid teacherId, HttpContext httpContext, LmsDbContext dbContext, string? courseCode) =>
{
    if (!TeacherWorkspaceAccessPolicy.CanAccessTeacherWorkspace(httpContext, teacherId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var query = dbContext.ContentDrafts.Where(x => x.TenantId == tenantId && x.TeacherId == teacherId);
    if (!string.IsNullOrWhiteSpace(courseCode))
    {
        query = query.Where(x => x.CourseCode == courseCode);
    }

    var items = await query.OrderByDescending(x => x.UpdatedAtUtc).ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/content-drafts", async (Guid teacherId, HttpContext httpContext, [FromBody] CreateContentDraftRequest request, LmsDbContext dbContext) =>
{
    if (!TeacherWorkspaceAccessPolicy.CanAccessTeacherWorkspace(httpContext, teacherId))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    var draft = new ContentDraft
    {
        Id = Guid.NewGuid(),
        TenantId = httpContext.GetValidatedTenantId(),
        TeacherId = teacherId,
        CourseCode = request.CourseCode.Trim(),
        DraftType = request.DraftType.Trim(),
        Title = request.Title.Trim(),
        Status = "Draft",
        UpdatedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.ContentDrafts.Add(draft);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/teachers/{teacherId}/content-drafts/{draft.Id}", draft);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

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
        FileName = safeFileName,
        CreatedAtUtc = DateTimeOffset.UtcNow
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
        CourseCode = request.CourseCode,
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

static string[] SplitList(string? value) =>
    string.IsNullOrWhiteSpace(value)
        ? []
        : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<LmsDbContext>();

    if (!await dbContext.Materials.AnyAsync())
    {
        dbContext.Materials.AddRange(
        [
            new CourseMaterial { Id = Guid.NewGuid(), TenantId = "default", CourseCode = "CSE401", Title = "Week 1 Slides", FileName = "week1-slides.pdf", ObjectKey = "default/materials/week1-slides.pdf", CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-7) },
            new CourseMaterial { Id = Guid.NewGuid(), TenantId = "default", CourseCode = "PHY201", Title = "Physics Revision Sheet", FileName = "physics-revision.pdf", ObjectKey = "default/materials/physics-revision.pdf", CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-4) }
        ]);
    }

    if (!await dbContext.Assignments.AnyAsync())
    {
        dbContext.Assignments.AddRange(
        [
            new AssignmentItem { Id = Guid.NewGuid(), TenantId = "default", CourseCode = "CSE401", Title = "Distributed Systems Lab 1", FileName = "lab1.pdf", ObjectKey = "default/assignments/lab1.pdf", UploadedAtUtc = DateTimeOffset.UtcNow.AddDays(-3) },
            new AssignmentItem { Id = Guid.NewGuid(), TenantId = "default", CourseCode = "MTH301", Title = "Matrices Problem Set", FileName = "matrices.pdf", ObjectKey = "default/assignments/matrices.pdf", UploadedAtUtc = DateTimeOffset.UtcNow.AddDays(-1) }
        ]);
    }
    if (!await dbContext.ContentDrafts.AnyAsync())
    {
        dbContext.ContentDrafts.AddRange(
        [
            new ContentDraft { Id = Guid.NewGuid(), TenantId = "default", TeacherId = KnownUsers.ProfessorId, CourseCode = "CSE401", DraftType = "Module Outline", Title = "Week 5 replication patterns", Status = "Draft", UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1) },
            new ContentDraft { Id = Guid.NewGuid(), TenantId = "default", TeacherId = KnownUsers.ProfessorId, CourseCode = "PHY201", DraftType = "Assessment Brief", Title = "Internal quiz moderation notes", Status = "Review Ready", UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-8) }
        ]);
    }
    if (!await dbContext.LifecyclePolicies.AnyAsync())
    {
        dbContext.LifecyclePolicies.Add(new StorageLifecyclePolicy { Id = Guid.NewGuid(), Bucket = "university360-materials", Prefix = "default/materials/", RetentionDays = 365, ArchiveAfterDays = 90 });
    }
    await dbContext.SaveChangesAsync();
}

public sealed record UploadRequest(string TenantId, string CourseCode, string Title, string FileName, string ContentType);
public sealed record CreateContentDraftRequest(string TenantId, string CourseCode, string DraftType, string Title);
public sealed record LifecyclePolicyRequest(string Bucket, string Prefix, int RetentionDays, int ArchiveAfterDays);

public sealed class CourseMaterial
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string CourseCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class AssignmentItem
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string CourseCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public DateTimeOffset UploadedAtUtc { get; set; }
}

public sealed class ContentDraft
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public string DraftType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft";
    public DateTimeOffset UpdatedAtUtc { get; set; }
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
    public DbSet<ContentDraft> ContentDrafts => Set<ContentDraft>();
    public DbSet<FileScanRecord> FileScans => Set<FileScanRecord>();
    public DbSet<StorageLifecyclePolicy> LifecyclePolicies => Set<StorageLifecyclePolicy>();
}

public static class KnownUsers
{
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
}

public static class TeacherWorkspaceAccessPolicy
{
    public static bool CanAccessTeacherWorkspace(HttpContext httpContext, Guid requestedUserId)
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
}
