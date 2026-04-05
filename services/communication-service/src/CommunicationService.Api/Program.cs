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

app.MapGet("/api/v1/public/homepage", async (CommunicationDbContext dbContext, IConfiguration configuration, string tenantId = "default") =>
{
    var announcements = await dbContext.Announcements
        .Where(x => x.TenantId == tenantId && (x.Audience == "All" || x.Audience == "Public"))
        .OrderByDescending(x => x.PublishedAtUtc)
        .Take(4)
        .ToListAsync();

    var tickerItems = await dbContext.TickerItems
        .Where(x => x.TenantId == tenantId)
        .OrderBy(x => x.SortOrder)
        .ThenByDescending(x => x.PublishedAtUtc)
        .Take(6)
        .Select(x => x.Message)
        .ToListAsync();

    return Results.Ok(new
    {
        tickerItems,
        announcements = announcements.Select(x => new
        {
            x.Id,
            x.Title,
            summary = x.Body.Length > 180 ? $"{x.Body[..177]}..." : x.Body,
            badge = x.Audience == "Public" ? "Admissions" : x.Audience,
            publishedOn = x.PublishedAtUtc.ToString("MMMM dd, yyyy")
        }),
        admissionsJourney = new[]
        {
            new { title = "Discover programs", detail = "Search campuses, compare levels, and shortlist the right academic path." },
            new { title = "Talk to admissions", detail = "Share your preferred campus or program and let the team guide next steps." },
            new { title = "Confirm the visit", detail = "Move from inquiry to counseling, campus walkthrough, and application readiness." }
        },
        contact = new
        {
            email = configuration["PublicExperience:AdmissionsEmail"] ?? "admissions@university360.edu",
            phone = configuration["PublicExperience:AdmissionsPhone"] ?? "+91 80000 12345",
            office = configuration["PublicExperience:AdmissionsOffice"] ?? "University Operations Office, Bengaluru"
        }
    });
});

app.MapPost("/api/v1/public/inquiries", async ([FromBody] AdmissionInquiryRequest request, CommunicationDbContext dbContext) =>
{
    if (string.IsNullOrWhiteSpace(request.FullName) ||
        string.IsNullOrWhiteSpace(request.Email) ||
        string.IsNullOrWhiteSpace(request.InterestedProgram) ||
        string.IsNullOrWhiteSpace(request.Message))
    {
        return Results.BadRequest(new { message = "Full name, email, interested program, and message are required." });
    }

    var inquiry = new AdmissionInquiry
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        FullName = request.FullName.Trim(),
        Email = request.Email.Trim(),
        Phone = request.Phone?.Trim() ?? string.Empty,
        PreferredCampus = request.PreferredCampus?.Trim() ?? string.Empty,
        InterestedProgram = request.InterestedProgram.Trim(),
        Message = request.Message.Trim(),
        Status = "New",
        Source = "website",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.AdmissionInquiries.Add(inquiry);
    dbContext.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Title = $"New admissions inquiry from {inquiry.FullName}",
        Message = $"{inquiry.InterestedProgram} - {inquiry.PreferredCampus}".Trim().TrimEnd('-').Trim(),
        Audience = "Admin",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        Source = "admissions"
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Action = "admissions.inquiry.created",
        EntityId = inquiry.Id.ToString(),
        Actor = inquiry.Email,
        Details = $"{inquiry.FullName} requested {inquiry.InterestedProgram} ({inquiry.PreferredCampus})",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(new
    {
        inquiryId = inquiry.Id,
        message = "Admissions inquiry submitted successfully. The team can now follow up from the operations hub."
    });
}).RequireRateLimiting("api");

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

app.MapGet("/api/v1/admissions/inquiries", async (HttpContext httpContext, CommunicationDbContext dbContext, string? status, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);

    var query = dbContext.AdmissionInquiries.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(x => x.Status == status);
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/summary", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var inquiries = await dbContext.AdmissionInquiries.Where(x => x.TenantId == tenantId).ToListAsync();

    return Results.Ok(new
    {
        total = inquiries.Count,
        newItems = inquiries.Count(x => x.Status == "New"),
        inReview = inquiries.Count(x => x.Status == "In Review"),
        latest = inquiries.OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault()
    });
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/inquiries/{id:guid}/status", async (Guid id, HttpContext httpContext, [FromBody] UpdateInquiryStatusRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var inquiry = await dbContext.AdmissionInquiries.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (inquiry is null)
    {
        return Results.NotFound();
    }

    inquiry.Status = request.Status;
    inquiry.AssignedTo = request.AssignedTo?.Trim() ?? inquiry.AssignedTo;
    inquiry.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.inquiry.status-updated",
        EntityId = inquiry.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{inquiry.FullName} inquiry moved to {request.Status}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(inquiry);
}).RequirePermissions("announcements.create");

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

    if (!await dbContext.Announcements.AnyAsync())
    {
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
            },
            new Announcement
            {
                TenantId = "default",
                Id = Guid.NewGuid(),
                Title = "Undergraduate admissions are now open",
                Body = "Applications are open across engineering, management, media, and health sciences pathways for the 2026 intake.",
                Audience = "Public",
                PublishedAtUtc = DateTimeOffset.UtcNow.AddHours(-3)
            }
        ]);
    }

    if (!await dbContext.TickerItems.AnyAsync())
    {
        dbContext.TickerItems.AddRange(
        [
            new TickerItem
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                Message = "Admissions counseling opens this week for engineering, commerce, and health sciences applicants.",
                SortOrder = 1,
                PublishedAtUtc = DateTimeOffset.UtcNow.AddHours(-6)
            },
            new TickerItem
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                Message = "Scholarship screening rounds begin on April 12 with digital slot confirmation.",
                SortOrder = 2,
                PublishedAtUtc = DateTimeOffset.UtcNow.AddHours(-5)
            },
            new TickerItem
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                Message = "Campus visits are now available in Bengaluru, Mysuru, and Chennai.",
                SortOrder = 3,
                PublishedAtUtc = DateTimeOffset.UtcNow.AddHours(-4)
            }
        ]);
    }

    if (!await dbContext.AdmissionInquiries.AnyAsync())
    {
        dbContext.AdmissionInquiries.AddRange(
        [
            new AdmissionInquiry
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                FullName = "Riya Menon",
                Email = "riya.menon@example.com",
                Phone = "+91 98765 10001",
                PreferredCampus = "North City Campus",
                InterestedProgram = "B.Tech Computer Science and Engineering",
                Message = "Looking for details about scholarships and hostel options.",
                Status = "New",
                Source = "website",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-7),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-7)
            },
            new AdmissionInquiry
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                FullName = "Aditya Rao",
                Email = "aditya.rao@example.com",
                Phone = "+91 98765 10002",
                PreferredCampus = "Health Sciences Campus",
                InterestedProgram = "B.Sc Allied Health Sciences",
                Message = "Please share the application timeline and seat availability.",
                Status = "In Review",
                Source = "website",
                AssignedTo = "Admissions Desk",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-10)
            }
        ]);
    }

    await dbContext.SaveChangesAsync();
}

public sealed record CreateAnnouncementRequest(string TenantId, string Title, string Body, string Audience);
public sealed record AdmissionInquiryRequest(string TenantId, string FullName, string Email, string? Phone, string? PreferredCampus, string InterestedProgram, string Message);
public sealed record UpdateInquiryStatusRequest(string Status, string? AssignedTo);

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

public sealed class TickerItem
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Message { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTimeOffset PublishedAtUtc { get; set; }
}

public sealed class AdmissionInquiry
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PreferredCampus { get; set; } = string.Empty;
    public string InterestedProgram { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = "New";
    public string Source { get; set; } = "website";
    public string AssignedTo { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
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
    public DbSet<TickerItem> TickerItems => Set<TickerItem>();
    public DbSet<AdmissionInquiry> AdmissionInquiries => Set<AdmissionInquiry>();
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
}
