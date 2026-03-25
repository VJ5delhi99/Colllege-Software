using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<CommunicationDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await SeedCommunicationDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "communication-service", features = new[] { "blogs", "announcements", "push-alerts" } }));

app.MapPost("/api/v1/announcements", async ([FromBody] CreateAnnouncementRequest request, CommunicationDbContext dbContext) =>
{
    var announcement = new Announcement
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Title = request.Title,
        Body = request.Body,
        Audience = request.Audience,
        PublishedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.Announcements.Add(announcement);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/announcements/{announcement.Id}", announcement);
}).RequireRateLimiting("api");

app.MapGet("/api/v1/announcements", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
    await dbContext.Announcements.Where(x => x.TenantId == httpContext.GetTenantId()).OrderByDescending(x => x.PublishedAtUtc).ToListAsync());

app.MapGet("/api/v1/dashboard/summary", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetTenantId();
    var total = await dbContext.Announcements.CountAsync(x => x.TenantId == tenantId);
    var latest = await dbContext.Announcements.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.PublishedAtUtc).FirstOrDefaultAsync();
    return Results.Ok(new { total, latest });
});

app.Run();

static async Task SeedCommunicationDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<CommunicationDbContext>();
    await dbContext.Database.EnsureCreatedAsync();

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

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public sealed class CommunicationDbContext(DbContextOptions<CommunicationDbContext> options) : DbContext(options)
{
    public DbSet<Announcement> Announcements => Set<Announcement>();
}
