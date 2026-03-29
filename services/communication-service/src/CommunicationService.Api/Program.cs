using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<CommunicationDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<CommunicationDbContext>();
await SeedCommunicationDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "communication-service", features = new[] { "blogs", "announcements", "push-alerts" } }));

app.MapPost("/api/v1/announcements", async (HttpContext httpContext, [FromBody] CreateAnnouncementRequest request, CommunicationDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Body))
    {
        return Results.BadRequest(new { message = "Title and body are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var announcement = new Announcement
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Title = request.Title,
        Body = request.Body,
        Audience = request.Audience,
        PublishedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.Announcements.Add(announcement);
    dbContext.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Title = request.Title,
        Message = request.Body.Length > 240 ? request.Body[..240] : request.Body,
        Audience = request.Audience,
        CreatedAtUtc = DateTimeOffset.UtcNow,
        Source = "announcement"
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "announcement.created",
        EntityId = announcement.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = announcement.Title,
        CreatedAtUtc = DateTimeOffset.UtcNow
    });
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/announcements/{announcement.Id}", announcement);
}).RequirePermissions("announcements.create").RequireRateLimiting("api");

app.MapGet("/api/v1/announcements", async (HttpContext httpContext, CommunicationDbContext dbContext, string? search, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.Announcements.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(x => x.Title.Contains(search) || x.Body.Contains(search) || x.Audience.Contains(search));
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.PublishedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
})
    .RequireRoles("Student", "Professor", "Principal", "Admin", "FinanceStaff", "DepartmentHead");

app.MapGet("/api/v1/dashboard/summary", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var total = await dbContext.Announcements.CountAsync(x => x.TenantId == tenantId);
    var latest = await dbContext.Announcements.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.PublishedAtUtc).FirstOrDefaultAsync();
    return Results.Ok(new { total, latest });
}).RequireRoles("Student", "Professor", "Principal", "Admin", "FinanceStaff", "DepartmentHead");

app.MapGet("/api/v1/notifications", async (HttpContext httpContext, CommunicationDbContext dbContext, string? audience, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.Notifications.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(audience))
    {
        query = query.Where(x => x.Audience == audience || x.Audience == "All");
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequireRoles("Student", "Professor", "Principal", "Admin", "FinanceStaff", "DepartmentHead");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, CommunicationDbContext dbContext, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.AuditLogs.Where(x => x.TenantId == tenantId);
    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("announcements.create");

app.Run();

static async Task SeedCommunicationDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<CommunicationDbContext>();
    if (await dbContext.Announcements.AnyAsync())
    {
        return;
    }

    dbContext.Announcements.AddRange(
    [
        new Announcement
        {
            TenantId = "default",
            Id = Guid.NewGuid(),
            Title = "Building a research-first campus culture in 2026",
            Body = "Leadership notes, institutional wins, and priorities for the current semester.",
            Audience = "All",
            PublishedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
        },
        new Announcement
        {
            TenantId = "default",
            Id = Guid.NewGuid(),
            Title = "Semester exams begin on April 12",
            Body = "Review the updated exam timetable and hall policies before reporting.",
            Audience = "Students",
            PublishedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
        },
        new Announcement
        {
            TenantId = "default",
            Id = Guid.NewGuid(),
            Title = "Faculty meeting on curriculum modernization",
            Body = "Department heads and professors are requested to join the review session.",
            Audience = "Professor",
            PublishedAtUtc = DateTimeOffset.UtcNow.AddHours(-8)
        }
    ]);

    await dbContext.SaveChangesAsync();
}

public sealed record CreateAnnouncementRequest(string TenantId, string Title, string Body, string Audience);

public sealed class Announcement
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Audience { get; set; } = "All";
    public DateTimeOffset PublishedAtUtc { get; set; }
}

public sealed class Notification
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Audience { get; set; } = "All";
    public string Source { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
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

public sealed class CommunicationDbContext(DbContextOptions<CommunicationDbContext> options) : DbContext(options)
{
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
}
