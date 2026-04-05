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

app.MapGet("/api/v1/helpdesk/summary", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var tickets = await dbContext.HelpdeskTickets.Where(x => x.TenantId == tenantId).ToListAsync();
    return Results.Ok(HelpdeskTicketSummary.Create(tickets));
}).RequireRoles("Principal", "Admin", "DepartmentHead", "FinanceStaff");

app.MapGet("/api/v1/helpdesk/tickets", async (HttpContext httpContext, CommunicationDbContext dbContext, string? status, string? department, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.HelpdeskTickets.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(x => x.Status == status);
    }

    if (!string.IsNullOrWhiteSpace(department))
    {
        query = query.Where(x => x.Department == department);
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequireRoles("Principal", "Admin", "DepartmentHead", "FinanceStaff");

app.MapGet("/api/v1/helpdesk/requesters/{requesterId:guid}/tickets", async (Guid requesterId, HttpContext httpContext, CommunicationDbContext dbContext, int pageSize = 10) =>
{
    if (!CanAccessOwnOperationalRecord(httpContext, requesterId, "Principal", "Admin", "DepartmentHead", "FinanceStaff"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.HelpdeskTickets
        .Where(x => x.TenantId == tenantId && x.RequesterId == requesterId)
        .OrderByDescending(x => x.CreatedAtUtc)
        .Take(Math.Clamp(pageSize, 1, 20))
        .ToListAsync();

    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Student", "Professor", "Principal", "Admin", "FinanceStaff", "DepartmentHead");

app.MapPost("/api/v1/helpdesk/tickets", async (HttpContext httpContext, [FromBody] CreateHelpdeskTicketRequest request, CommunicationDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.Department))
    {
        return Results.BadRequest(new { message = "Department, title, and description are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var requesterId = request.RequesterId ?? ResolveCurrentUserId(httpContext) ?? Guid.NewGuid();
    var requesterRole = httpContext.User.FindFirst("role")?.Value
        ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
        ?? request.RequesterRole
        ?? "User";
    var ticket = new HelpdeskTicket
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        RequesterId = requesterId,
        RequesterName = request.RequesterName?.Trim() ?? httpContext.User.Identity?.Name ?? "Portal User",
        RequesterRole = requesterRole,
        Department = request.Department.Trim(),
        Category = request.Category?.Trim() ?? "General Support",
        Title = request.Title.Trim(),
        Description = request.Description.Trim(),
        Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Medium" : request.Priority.Trim(),
        Status = "Open",
        AssignedTo = string.Empty,
        CreatedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.HelpdeskTickets.Add(ticket);
    dbContext.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Title = $"New helpdesk ticket for {ticket.Department}",
        Message = $"{ticket.Title} | {ticket.Priority}",
        Audience = "Admin",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        Source = "helpdesk"
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "helpdesk.ticket.created",
        EntityId = ticket.Id.ToString(),
        Actor = ticket.RequesterName,
        Details = $"{ticket.Department} | {ticket.Title}",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/helpdesk/tickets/{ticket.Id}", ticket);
}).RequireRoles("Student", "Professor", "Principal", "Admin", "FinanceStaff", "DepartmentHead");

app.MapPost("/api/v1/helpdesk/tickets/{id:guid}/status", async (Guid id, HttpContext httpContext, [FromBody] UpdateHelpdeskTicketStatusRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var ticket = await dbContext.HelpdeskTickets.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (ticket is null)
    {
        return Results.NotFound();
    }

    ticket.Status = request.Status.Trim();
    ticket.AssignedTo = request.AssignedTo?.Trim() ?? ticket.AssignedTo;
    ticket.ResolutionNote = request.ResolutionNote?.Trim() ?? ticket.ResolutionNote;
    ticket.UpdatedAtUtc = DateTimeOffset.UtcNow;
    ticket.ResolvedAtUtc =
        string.Equals(ticket.Status, "Resolved", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(ticket.Status, "Closed", StringComparison.OrdinalIgnoreCase)
            ? DateTimeOffset.UtcNow
            : ticket.ResolvedAtUtc;

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "helpdesk.ticket.status-updated",
        EntityId = ticket.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{ticket.Title} moved to {ticket.Status}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(ticket);
}).RequireRoles("Principal", "Admin", "DepartmentHead", "FinanceStaff");

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
    var applications = await dbContext.AdmissionApplications.Where(x => x.TenantId == tenantId).ToListAsync();
    var counselingSessions = await dbContext.CounselingSessions.Where(x => x.TenantId == tenantId).ToListAsync();
    var documents = await dbContext.ApplicationDocuments.Where(x => x.TenantId == tenantId).ToListAsync();
    var communications = await dbContext.AdmissionCommunications.Where(x => x.TenantId == tenantId).ToListAsync();
    var reminders = await dbContext.AdmissionReminders.Where(x => x.TenantId == tenantId).ToListAsync();

    return Results.Ok(AdmissionsWorkflowMetrics.Create(inquiries, applications, counselingSessions, documents, communications, reminders));
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/automation/run", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var applications = await dbContext.AdmissionApplications.Where(x => x.TenantId == tenantId).ToListAsync();
    var documents = await dbContext.ApplicationDocuments.Where(x => x.TenantId == tenantId).ToListAsync();
    var communications = await dbContext.AdmissionCommunications.Where(x => x.TenantId == tenantId).ToListAsync();
    var reminders = await dbContext.AdmissionReminders.Where(x => x.TenantId == tenantId).ToListAsync();

    var run = AdmissionsAutomationEngine.Run(tenantId, applications, documents, communications, reminders, DateTimeOffset.UtcNow);
    if (run.CreatedReminders.Count > 0)
    {
        dbContext.AdmissionReminders.AddRange(run.CreatedReminders);
    }

    if (run.CreatedNotifications.Count > 0)
    {
        dbContext.Notifications.AddRange(run.CreatedNotifications);
    }

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.automation.executed",
        EntityId = Guid.NewGuid().ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "automation",
        Details = $"Automation created {run.CreatedReminders.Count} reminders and flagged {run.Metrics.StaleApplications} stale applications.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(new
    {
        createdReminders = run.CreatedReminders.Count,
        createdNotifications = run.CreatedNotifications.Count,
        metrics = run.Metrics
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

app.MapPost("/api/v1/admissions/applications", async (HttpContext httpContext, [FromBody] CreateAdmissionApplicationRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();

    if (string.IsNullOrWhiteSpace(request.ApplicantName) || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.ProgramName))
    {
        return Results.BadRequest(new { message = "Applicant name, email, and program name are required." });
    }

    AdmissionInquiry? inquiry = null;
    if (request.InquiryId.HasValue)
    {
        inquiry = await dbContext.AdmissionInquiries.FirstOrDefaultAsync(x => x.Id == request.InquiryId.Value && x.TenantId == tenantId);
        if (inquiry is null)
        {
            return Results.NotFound(new { message = "Inquiry not found." });
        }
    }

    var application = new AdmissionApplication
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        InquiryId = request.InquiryId,
        ApplicantName = request.ApplicantName.Trim(),
        Email = request.Email.Trim(),
        Phone = request.Phone?.Trim() ?? string.Empty,
        CampusName = request.CampusName?.Trim() ?? inquiry?.PreferredCampus ?? string.Empty,
        ProgramName = request.ProgramName.Trim(),
        Stage = "Application Review",
        Status = "Submitted",
        ApplicationNumber = $"APP-{DateTimeOffset.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    };

    if (inquiry is not null)
    {
        inquiry.Status = "Converted";
        inquiry.AssignedTo = request.AssignedTo?.Trim() ?? inquiry.AssignedTo;
        inquiry.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    dbContext.AdmissionApplications.Add(application);
    dbContext.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Title = $"Application created for {application.ApplicantName}",
        Message = $"{application.ProgramName} | {application.CampusName}",
        Audience = "Admin",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        Source = "admissions"
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.application.created",
        EntityId = application.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{application.ApplicantName} application created for {application.ProgramName}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/admissions/applications/{application.Id}", application);
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/applications", async (HttpContext httpContext, CommunicationDbContext dbContext, string? status, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);

    var query = dbContext.AdmissionApplications.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(x => x.Status == status);
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/counseling-sessions", async (HttpContext httpContext, [FromBody] CreateCounselingSessionRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var application = await dbContext.AdmissionApplications.FirstOrDefaultAsync(x => x.Id == request.ApplicationId && x.TenantId == tenantId);
    if (application is null)
    {
        return Results.NotFound(new { message = "Application not found." });
    }

    var session = new CounselingSession
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ApplicationId = application.Id,
        ApplicantName = application.ApplicantName,
        ProgramName = application.ProgramName,
        CampusName = application.CampusName,
        CounselorName = request.CounselorName?.Trim() ?? httpContext.User.Identity?.Name ?? "Admissions Desk",
        ScheduledAtUtc = request.ScheduledAtUtc,
        Modality = string.IsNullOrWhiteSpace(request.Modality) ? "Campus Visit" : request.Modality.Trim(),
        Status = "Scheduled",
        Notes = request.Notes?.Trim() ?? string.Empty,
        CreatedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    };

    application.Stage = "Counseling Scheduled";
    application.Status = application.Status == "Submitted" ? "Under Review" : application.Status;
    application.AssignedTo = session.CounselorName;
    application.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.CounselingSessions.Add(session);
    dbContext.AdmissionReminders.Add(new AdmissionReminder
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ApplicationId = application.Id,
        ApplicantName = application.ApplicantName,
        ReminderType = "Counseling Follow-Up",
        DueAtUtc = session.ScheduledAtUtc.AddHours(-12),
        Status = "Open",
        Notes = "Reach out before the scheduled counseling session.",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    });
    dbContext.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Title = $"Counseling scheduled for {application.ApplicantName}",
        Message = $"{session.Modality} on {session.ScheduledAtUtc:dd MMM yyyy hh:mm tt}",
        Audience = "Admin",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        Source = "admissions"
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.counseling.scheduled",
        EntityId = session.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{application.ApplicantName} counseling scheduled for {session.ScheduledAtUtc:dd MMM yyyy hh:mm tt}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/admissions/counseling-sessions/{session.Id}", session);
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/counseling-sessions", async (HttpContext httpContext, CommunicationDbContext dbContext, string? status, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);

    var query = dbContext.CounselingSessions.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(x => x.Status == status);
    }

    var total = await query.CountAsync();
    var items = await query.OrderBy(x => x.ScheduledAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/counseling-sessions/{id:guid}/status", async (Guid id, HttpContext httpContext, [FromBody] UpdateCounselingSessionStatusRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var session = await dbContext.CounselingSessions.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (session is null)
    {
        return Results.NotFound();
    }

    session.Status = request.Status;
    session.Notes = request.Notes?.Trim() ?? session.Notes;
    session.UpdatedAtUtc = DateTimeOffset.UtcNow;

    var application = await dbContext.AdmissionApplications.FirstOrDefaultAsync(x => x.Id == session.ApplicationId && x.TenantId == tenantId);
    if (application is not null && string.Equals(request.Status, "Completed", StringComparison.OrdinalIgnoreCase))
    {
        application.Stage = "Document Verification";
        application.Status = "Under Review";
        application.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.counseling.status-updated",
        EntityId = session.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{session.ApplicantName} counseling moved to {request.Status}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(session);
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/applications/{id:guid}/documents", async (Guid id, HttpContext httpContext, [FromBody] CreateApplicationDocumentRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var application = await dbContext.AdmissionApplications.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (application is null)
    {
        return Results.NotFound(new { message = "Application not found." });
    }

    var document = new ApplicationDocument
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ApplicationId = application.Id,
        ApplicantName = application.ApplicantName,
        DocumentType = request.DocumentType.Trim(),
        Status = "Requested",
        Notes = request.Notes?.Trim() ?? string.Empty,
        RequestedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    };

    application.Stage = "Document Verification";
    application.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.ApplicationDocuments.Add(document);
    dbContext.AdmissionReminders.Add(new AdmissionReminder
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ApplicationId = application.Id,
        ApplicantName = application.ApplicantName,
        ReminderType = $"{document.DocumentType} follow-up",
        DueAtUtc = DateTimeOffset.UtcNow.AddDays(2),
        Status = "Open",
        Notes = "Follow up with the applicant if the requested document is not submitted.",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.document.requested",
        EntityId = document.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{document.DocumentType} requested for {application.ApplicantName}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/admissions/documents/{document.Id}", document);
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/communications", async (HttpContext httpContext, [FromBody] CreateAdmissionCommunicationRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var application = await dbContext.AdmissionApplications.FirstOrDefaultAsync(x => x.Id == request.ApplicationId && x.TenantId == tenantId);
    if (application is null)
    {
        return Results.NotFound(new { message = "Application not found." });
    }

    var communication = new AdmissionCommunication
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ApplicationId = application.Id,
        ApplicantName = application.ApplicantName,
        Channel = string.IsNullOrWhiteSpace(request.Channel) ? "Email" : request.Channel.Trim(),
        TemplateName = request.TemplateName?.Trim() ?? "Manual Follow-Up",
        Subject = request.Subject.Trim(),
        Body = request.Body.Trim(),
        Status = "Sent",
        ScheduledForUtc = request.ScheduledForUtc,
        SentAtUtc = DateTimeOffset.UtcNow,
        CreatedAtUtc = DateTimeOffset.UtcNow,
        CreatedBy = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown"
    };

    dbContext.AdmissionCommunications.Add(communication);
    dbContext.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Title = $"Applicant follow-up sent to {application.ApplicantName}",
        Message = $"{communication.Channel} | {communication.Subject}",
        Audience = "Admin",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        Source = "admissions"
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.communication.sent",
        EntityId = communication.Id.ToString(),
        Actor = communication.CreatedBy,
        Details = $"{communication.Channel} follow-up sent to {application.ApplicantName}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/admissions/communications/{communication.Id}", communication);
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/communications", async (HttpContext httpContext, CommunicationDbContext dbContext, string? channel, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.AdmissionCommunications.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(channel))
    {
        query = query.Where(x => x.Channel == channel);
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/templates", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.AdmissionJourneyTemplates
        .Where(x => x.TenantId == tenantId)
        .OrderBy(x => x.SortOrder)
        .ThenBy(x => x.TemplateName)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/counselor-workloads", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var applications = await dbContext.AdmissionApplications.Where(x => x.TenantId == tenantId).ToListAsync();
    var counselingSessions = await dbContext.CounselingSessions.Where(x => x.TenantId == tenantId).ToListAsync();
    return Results.Ok(AdmissionsCounselorWorkloadSummary.Create(applications, counselingSessions, DateTimeOffset.UtcNow));
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/outreach/run", async (HttpContext httpContext, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var applications = await dbContext.AdmissionApplications.Where(x => x.TenantId == tenantId).ToListAsync();
    var documents = await dbContext.ApplicationDocuments.Where(x => x.TenantId == tenantId).ToListAsync();
    var communications = await dbContext.AdmissionCommunications.Where(x => x.TenantId == tenantId).ToListAsync();
    var reminders = await dbContext.AdmissionReminders.Where(x => x.TenantId == tenantId).ToListAsync();
    var counselingSessions = await dbContext.CounselingSessions.Where(x => x.TenantId == tenantId).ToListAsync();
    var templates = await dbContext.AdmissionJourneyTemplates.Where(x => x.TenantId == tenantId && x.IsActive).OrderBy(x => x.SortOrder).ToListAsync();

    var run = AdmissionsOutreachEngine.Run(tenantId, applications, documents, communications, reminders, counselingSessions, templates, DateTimeOffset.UtcNow);
    if (run.CreatedCommunications.Count > 0)
    {
        dbContext.AdmissionCommunications.AddRange(run.CreatedCommunications);
    }

    if (run.CreatedNotifications.Count > 0)
    {
        dbContext.Notifications.AddRange(run.CreatedNotifications);
    }

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.outreach.executed",
        EntityId = Guid.NewGuid().ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "automation",
        Details = $"Outreach created {run.CreatedCommunications.Count} communications and reassigned {run.RebalancedApplications} applications.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(new
    {
        createdCommunications = run.CreatedCommunications.Count,
        rebalancedApplications = run.RebalancedApplications,
        counselorWorkloads = run.CounselorWorkloads
    });
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/reminders", async (HttpContext httpContext, [FromBody] CreateAdmissionReminderRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var application = await dbContext.AdmissionApplications.FirstOrDefaultAsync(x => x.Id == request.ApplicationId && x.TenantId == tenantId);
    if (application is null)
    {
        return Results.NotFound(new { message = "Application not found." });
    }

    var reminder = new AdmissionReminder
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ApplicationId = application.Id,
        ApplicantName = application.ApplicantName,
        ReminderType = request.ReminderType.Trim(),
        DueAtUtc = request.DueAtUtc,
        Status = "Open",
        Notes = request.Notes?.Trim() ?? string.Empty,
        CreatedAtUtc = DateTimeOffset.UtcNow,
        UpdatedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.AdmissionReminders.Add(reminder);
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.reminder.created",
        EntityId = reminder.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{reminder.ReminderType} reminder created for {application.ApplicantName}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/admissions/reminders/{reminder.Id}", reminder);
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/reminders", async (HttpContext httpContext, CommunicationDbContext dbContext, string? status, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.AdmissionReminders.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(x => x.Status == status);
    }

    var total = await query.CountAsync();
    var items = await query.OrderBy(x => x.DueAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/reminders/{id:guid}/status", async (Guid id, HttpContext httpContext, [FromBody] UpdateAdmissionReminderStatusRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var reminder = await dbContext.AdmissionReminders.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (reminder is null)
    {
        return Results.NotFound();
    }

    reminder.Status = request.Status;
    reminder.Notes = request.Notes?.Trim() ?? reminder.Notes;
    reminder.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.reminder.status-updated",
        EntityId = reminder.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{reminder.ReminderType} reminder moved to {request.Status}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(reminder);
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/documents/pending", async (HttpContext httpContext, CommunicationDbContext dbContext, string? status, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);

    var query = dbContext.ApplicationDocuments.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(x => x.Status == status);
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.RequestedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/documents/{id:guid}/status", async (Guid id, HttpContext httpContext, [FromBody] UpdateApplicationDocumentStatusRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var document = await dbContext.ApplicationDocuments.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (document is null)
    {
        return Results.NotFound();
    }

    document.Status = request.Status;
    document.Notes = request.Notes?.Trim() ?? document.Notes;
    document.UpdatedAtUtc = DateTimeOffset.UtcNow;

    var application = await dbContext.AdmissionApplications.FirstOrDefaultAsync(x => x.Id == document.ApplicationId && x.TenantId == tenantId);
    if (application is not null)
    {
        var documents = await dbContext.ApplicationDocuments.Where(x => x.ApplicationId == application.Id && x.TenantId == tenantId).ToListAsync();
        if (documents.All(x =>
            string.Equals(x.Status, "Verified", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(x.Status, "Delivered", StringComparison.OrdinalIgnoreCase)))
        {
            application.Stage = "Ready For Offer Review";
            application.Status = "Qualified";
            application.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
    }

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.document.status-updated",
        EntityId = document.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{document.DocumentType} moved to {request.Status} for {document.ApplicantName}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(document);
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/documents/{id:guid}/upload-request", async (Guid id, HttpContext httpContext, [FromBody] AdmissionDocumentUploadRequest request, IObjectStorageService storage, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var document = await dbContext.ApplicationDocuments.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (document is null)
    {
        return Results.NotFound();
    }

    if (!IsAllowedAdmissionsContentType(request.ContentType))
    {
        return Results.BadRequest(new { message = "Unsupported document file type." });
    }

    var safeFileName = SanitizeAdmissionsFileName(request.FileName);
    var objectKey = $"{tenantId}/admissions/{document.ApplicationId}/{document.Id}-{safeFileName}";
    var signedUrl = await storage.CreateUploadUrlAsync("university360-admissions", objectKey, request.ContentType, TimeSpan.FromMinutes(15));

    document.ObjectKey = objectKey;
    document.FileName = safeFileName;
    document.ContentType = request.ContentType;
    document.UploadedAtUtc = DateTimeOffset.UtcNow;
    document.Status = document.Status == "Requested" ? "Under Review" : document.Status;
    document.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.document.upload-requested",
        EntityId = document.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{document.DocumentType} upload request prepared for {document.ApplicantName}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(new { document, upload = signedUrl });
}).RequirePermissions("announcements.create");

app.MapGet("/api/v1/admissions/documents/{id:guid}/download-url", async (Guid id, HttpContext httpContext, IObjectStorageService storage, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var document = await dbContext.ApplicationDocuments.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (document is null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(document.ObjectKey))
    {
        return Results.BadRequest(new { message = "No uploaded file is available for this document yet." });
    }

    var signedUrl = await storage.CreateDownloadUrlAsync("university360-admissions", document.ObjectKey, TimeSpan.FromMinutes(30));
    document.DownloadedAtUtc = DateTimeOffset.UtcNow;
    document.UpdatedAtUtc = DateTimeOffset.UtcNow;
    await dbContext.SaveChangesAsync();
    return Results.Ok(signedUrl);
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/documents/{id:guid}/deliver", async (Guid id, HttpContext httpContext, [FromBody] DeliverApplicationDocumentRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var document = await dbContext.ApplicationDocuments.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (document is null)
    {
        return Results.NotFound();
    }

    document.Status = "Delivered";
    document.DeliveryChannel = string.IsNullOrWhiteSpace(request.DeliveryChannel) ? "Portal Download" : request.DeliveryChannel.Trim();
    document.DeliveryReference = string.IsNullOrWhiteSpace(document.DeliveryReference) ? $"DOC-{DateTimeOffset.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}" : document.DeliveryReference;
    document.DeliveredAtUtc = DateTimeOffset.UtcNow;
    document.Notes = request.Notes?.Trim() ?? document.Notes;
    document.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.Notifications.Add(new Notification
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Title = $"Document delivered for {document.ApplicantName}",
        Message = $"{document.DocumentType} | {document.DeliveryChannel}",
        Audience = "Admin",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        Source = "admissions"
    });
    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.document.delivered",
        EntityId = document.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{document.DocumentType} delivered for {document.ApplicantName} via {document.DeliveryChannel}.",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(document);
}).RequirePermissions("announcements.create");

app.MapPost("/api/v1/admissions/applications/{id:guid}/status", async (Guid id, HttpContext httpContext, [FromBody] UpdateAdmissionApplicationStatusRequest request, CommunicationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var application = await dbContext.AdmissionApplications.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (application is null)
    {
        return Results.NotFound();
    }

    application.Status = request.Status;
    application.Stage = request.Stage?.Trim() ?? application.Stage;
    application.AssignedTo = request.AssignedTo?.Trim() ?? application.AssignedTo;
    application.UpdatedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "admissions.application.status-updated",
        EntityId = application.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{application.ApplicantName} application moved to {request.Status} ({application.Stage}).",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Ok(application);
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

static bool IsAllowedAdmissionsContentType(string contentType) =>
    contentType is
        "application/pdf" or
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or
        "image/jpeg" or
        "image/png" or
        "text/plain";

static string SanitizeAdmissionsFileName(string fileName)
{
    var invalidChars = Path.GetInvalidFileNameChars();
    var sanitized = new string(fileName.Where(ch => !invalidChars.Contains(ch)).ToArray()).Trim();
    return string.IsNullOrWhiteSpace(sanitized) ? "document.bin" : sanitized.Replace(' ', '-');
}

static Guid? ResolveCurrentUserId(HttpContext httpContext)
{
    var raw = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? httpContext.User.FindFirst("sub")?.Value;
    return Guid.TryParse(raw, out var parsed) ? parsed : null;
}

static bool CanAccessOwnOperationalRecord(HttpContext httpContext, Guid requestedUserId, params string[] elevatedRoles)
{
    var role = httpContext.User.FindFirst("role")?.Value
        ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
        ?? string.Empty;

    if (elevatedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
    {
        return true;
    }

    var currentUserId = ResolveCurrentUserId(httpContext);
    return currentUserId.HasValue && currentUserId.Value == requestedUserId;
}

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

    if (!await dbContext.AdmissionApplications.AnyAsync())
    {
        dbContext.AdmissionApplications.AddRange(
        [
            new AdmissionApplication
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                ApplicantName = "Riya Menon",
                Email = "riya.menon@example.com",
                Phone = "+91 98765 10001",
                CampusName = "North City Campus",
                ProgramName = "B.Tech Computer Science and Engineering",
                Stage = "Application Review",
                Status = "Submitted",
                AssignedTo = "Admissions Desk",
                ApplicationNumber = "APP-20260405-1001",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-5),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-5)
            },
            new AdmissionApplication
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                ApplicantName = "Aditya Rao",
                Email = "aditya.rao@example.com",
                Phone = "+91 98765 10002",
                CampusName = "Health Sciences Campus",
                ProgramName = "B.Sc Allied Health Sciences",
                Stage = "Interview Scheduling",
                Status = "Qualified",
                AssignedTo = "Admissions Desk",
                ApplicationNumber = "APP-20260405-1002",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-8)
            }
        ]);
    }

    if (!await dbContext.CounselingSessions.AnyAsync())
    {
        var application = await dbContext.AdmissionApplications.OrderBy(x => x.CreatedAtUtc).FirstOrDefaultAsync(x => x.TenantId == "default");
        if (application is not null)
        {
            dbContext.CounselingSessions.Add(new CounselingSession
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                ApplicationId = application.Id,
                ApplicantName = application.ApplicantName,
                ProgramName = application.ProgramName,
                CampusName = application.CampusName,
                CounselorName = "Admissions Desk",
                ScheduledAtUtc = DateTimeOffset.UtcNow.AddDays(1),
                Modality = "Campus Visit",
                Status = "Scheduled",
                Notes = "Prospect requested scholarship and hostel guidance.",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-2),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-2)
            });
        }
    }

    if (!await dbContext.ApplicationDocuments.AnyAsync())
    {
        var applications = await dbContext.AdmissionApplications.Where(x => x.TenantId == "default").OrderBy(x => x.CreatedAtUtc).Take(2).ToListAsync();
        foreach (var application in applications)
        {
            dbContext.ApplicationDocuments.Add(new ApplicationDocument
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                ApplicationId = application.Id,
                ApplicantName = application.ApplicantName,
                DocumentType = application.ProgramName.Contains("B.Tech", StringComparison.OrdinalIgnoreCase) ? "Academic Transcript" : "Transfer Certificate",
                Status = application.ApplicantName.Contains("Aditya", StringComparison.OrdinalIgnoreCase) ? "Verified" : "Requested",
                Notes = application.ApplicantName.Contains("Aditya", StringComparison.OrdinalIgnoreCase) ? "Initial review completed." : "Waiting for applicant upload.",
                FileName = application.ApplicantName.Contains("Aditya", StringComparison.OrdinalIgnoreCase) ? "aditya-transfer-certificate.pdf" : string.Empty,
                ObjectKey = application.ApplicantName.Contains("Aditya", StringComparison.OrdinalIgnoreCase) ? $"default/admissions/{application.Id}/transfer-certificate.pdf" : string.Empty,
                ContentType = application.ApplicantName.Contains("Aditya", StringComparison.OrdinalIgnoreCase) ? "application/pdf" : string.Empty,
                RequestedAtUtc = DateTimeOffset.UtcNow.AddHours(-4),
                UploadedAtUtc = application.ApplicantName.Contains("Aditya", StringComparison.OrdinalIgnoreCase) ? DateTimeOffset.UtcNow.AddHours(-3) : null,
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-3)
            });
        }
    }

    if (!await dbContext.AdmissionCommunications.AnyAsync())
    {
        var application = await dbContext.AdmissionApplications.Where(x => x.TenantId == "default").OrderBy(x => x.CreatedAtUtc).FirstOrDefaultAsync();
        if (application is not null)
        {
            dbContext.AdmissionCommunications.Add(new AdmissionCommunication
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                ApplicationId = application.Id,
                ApplicantName = application.ApplicantName,
                Channel = "Email",
                TemplateName = "Application Follow-Up",
                Subject = "Next steps for your University360 application",
                Body = "Please review the counseling schedule and keep your academic transcript ready for verification.",
                Status = "Sent",
                SentAtUtc = DateTimeOffset.UtcNow.AddHours(-1),
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-1),
                CreatedBy = "Admissions Desk"
            });
        }
    }

    if (!await dbContext.AdmissionReminders.AnyAsync())
    {
        var applications = await dbContext.AdmissionApplications.Where(x => x.TenantId == "default").OrderBy(x => x.CreatedAtUtc).Take(2).ToListAsync();
        foreach (var application in applications)
        {
            dbContext.AdmissionReminders.Add(new AdmissionReminder
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                ApplicationId = application.Id,
                ApplicantName = application.ApplicantName,
                ReminderType = application.ApplicantName.Contains("Riya", StringComparison.OrdinalIgnoreCase) ? "Document Follow-Up" : "Offer Review",
                DueAtUtc = DateTimeOffset.UtcNow.AddHours(application.ApplicantName.Contains("Riya", StringComparison.OrdinalIgnoreCase) ? 18 : 30),
                Status = application.ApplicantName.Contains("Riya", StringComparison.OrdinalIgnoreCase) ? "Open" : "Completed",
                Notes = application.ApplicantName.Contains("Riya", StringComparison.OrdinalIgnoreCase) ? "Call the applicant if transcript upload is still pending." : "Offer review completed by admissions desk.",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-2),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-1)
            });
        }
    }

    if (!await dbContext.HelpdeskTickets.AnyAsync())
    {
        dbContext.HelpdeskTickets.AddRange(
        [
            new HelpdeskTicket
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                RequesterId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
                RequesterName = "Aarav Sharma",
                RequesterRole = "Student",
                Department = "IT Department",
                Category = "Portal Access",
                Title = "Unable to access semester registration portal",
                Description = "The portal shows an authorization error during registration submission.",
                Priority = "High",
                Status = "Open",
                AssignedTo = "Systems Desk",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-8),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-6)
            },
            new HelpdeskTicket
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                RequesterId = Guid.Parse("00000000-0000-0000-0000-000000000456"),
                RequesterName = "Prof. Meera Nair",
                RequesterRole = "Professor",
                Department = "Facility Management",
                Category = "Classroom AV",
                Title = "Projector issue in B-204",
                Description = "The classroom projector is intermittently disconnecting during lectures.",
                Priority = "Medium",
                Status = "In Progress",
                AssignedTo = "AV Support Team",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-12),
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddHours(-2)
            }
        ]);
    }

    await dbContext.SaveChangesAsync();
}

public sealed record CreateAnnouncementRequest(string TenantId, string Title, string Body, string Audience);
public sealed record AdmissionInquiryRequest(string TenantId, string FullName, string Email, string? Phone, string? PreferredCampus, string InterestedProgram, string Message);
public sealed record UpdateInquiryStatusRequest(string Status, string? AssignedTo);
public sealed record CreateAdmissionApplicationRequest(Guid? InquiryId, string ApplicantName, string Email, string? Phone, string? CampusName, string ProgramName, string? AssignedTo);
public sealed record UpdateAdmissionApplicationStatusRequest(string Status, string? Stage, string? AssignedTo);
public sealed record CreateCounselingSessionRequest(Guid ApplicationId, DateTimeOffset ScheduledAtUtc, string? CounselorName, string? Modality, string? Notes);
public sealed record UpdateCounselingSessionStatusRequest(string Status, string? Notes);
public sealed record CreateApplicationDocumentRequest(string DocumentType, string? Notes);
public sealed record UpdateApplicationDocumentStatusRequest(string Status, string? Notes);
public sealed record CreateAdmissionCommunicationRequest(Guid ApplicationId, string Channel, string Subject, string Body, string? TemplateName, DateTimeOffset? ScheduledForUtc);
public sealed record CreateAdmissionReminderRequest(Guid ApplicationId, string ReminderType, DateTimeOffset DueAtUtc, string? Notes);
public sealed record UpdateAdmissionReminderStatusRequest(string Status, string? Notes);
public sealed record AdmissionDocumentUploadRequest(string FileName, string ContentType);
public sealed record DeliverApplicationDocumentRequest(string? DeliveryChannel, string? Notes);
public sealed record CreateHelpdeskTicketRequest(string TenantId, Guid? RequesterId, string? RequesterName, string? RequesterRole, string Department, string? Category, string Title, string Description, string? Priority);
public sealed record UpdateHelpdeskTicketStatusRequest(string Status, string? AssignedTo, string? ResolutionNote);

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

public sealed class AdmissionApplication
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid? InquiryId { get; set; }
    public string ApplicationNumber { get; set; } = string.Empty;
    public string ApplicantName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string CampusName { get; set; } = string.Empty;
    public string ProgramName { get; set; } = string.Empty;
    public string Stage { get; set; } = "Application Review";
    public string Status { get; set; } = "Submitted";
    public string AssignedTo { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class CounselingSession
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid ApplicationId { get; set; }
    public string ApplicantName { get; set; } = string.Empty;
    public string ProgramName { get; set; } = string.Empty;
    public string CampusName { get; set; } = string.Empty;
    public string CounselorName { get; set; } = string.Empty;
    public DateTimeOffset ScheduledAtUtc { get; set; }
    public string Modality { get; set; } = "Campus Visit";
    public string Status { get; set; } = "Scheduled";
    public string Notes { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class ApplicationDocument
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid ApplicationId { get; set; }
    public string ApplicantName { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string Status { get; set; } = "Requested";
    public string Notes { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string DeliveryChannel { get; set; } = string.Empty;
    public string DeliveryReference { get; set; } = string.Empty;
    public DateTimeOffset RequestedAtUtc { get; set; }
    public DateTimeOffset? UploadedAtUtc { get; set; }
    public DateTimeOffset? DeliveredAtUtc { get; set; }
    public DateTimeOffset? DownloadedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class AdmissionCommunication
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid ApplicationId { get; set; }
    public string ApplicantName { get; set; } = string.Empty;
    public string Channel { get; set; } = "Email";
    public string TemplateName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Status { get; set; } = "Sent";
    public DateTimeOffset? ScheduledForUtc { get; set; }
    public DateTimeOffset? SentAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}

public sealed class AdmissionReminder
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid ApplicationId { get; set; }
    public string ApplicantName { get; set; } = string.Empty;
    public string ReminderType { get; set; } = string.Empty;
    public DateTimeOffset DueAtUtc { get; set; }
    public string Status { get; set; } = "Open";
    public string Notes { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class HelpdeskTicket
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid RequesterId { get; set; }
    public string RequesterName { get; set; } = string.Empty;
    public string RequesterRole { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Priority { get; set; } = "Medium";
    public string Status { get; set; } = "Open";
    public string AssignedTo { get; set; } = string.Empty;
    public string ResolutionNote { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? ResolvedAtUtc { get; set; }
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
    public DbSet<AdmissionApplication> AdmissionApplications => Set<AdmissionApplication>();
    public DbSet<CounselingSession> CounselingSessions => Set<CounselingSession>();
    public DbSet<ApplicationDocument> ApplicationDocuments => Set<ApplicationDocument>();
    public DbSet<AdmissionCommunication> AdmissionCommunications => Set<AdmissionCommunication>();
    public DbSet<AdmissionReminder> AdmissionReminders => Set<AdmissionReminder>();
    public DbSet<HelpdeskTicket> HelpdeskTickets => Set<HelpdeskTicket>();
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
}

public static class AdmissionsWorkflowMetrics
{
    public static AdmissionsWorkflowSummary Create(
        IReadOnlyCollection<AdmissionInquiry> inquiries,
        IReadOnlyCollection<AdmissionApplication> applications,
        IReadOnlyCollection<CounselingSession> counselingSessions,
        IReadOnlyCollection<ApplicationDocument> documents,
        IReadOnlyCollection<AdmissionCommunication> communications,
        IReadOnlyCollection<AdmissionReminder> reminders)
    {
        var automation = AdmissionsAutomationMetrics.Create(applications, documents, communications, reminders, DateTimeOffset.UtcNow);
        return new(
            inquiries.Count,
            inquiries.Count(x => x.Status == "New"),
            inquiries.Count(x => x.Status == "In Review"),
            inquiries.OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault(),
            new AdmissionsApplicationMetrics(
                applications.Count,
                applications.Count(x => x.Status == "Submitted"),
                applications.Count(x => x.Status == "Under Review"),
                applications.Count(x => x.Status == "Qualified"),
                applications.Count(x => x.Status == "Offered")),
            new AdmissionsCounselingMetrics(
                counselingSessions.Count,
                counselingSessions.Count(x => x.Status == "Scheduled"),
                counselingSessions.Count(x => x.Status == "Completed")),
            new AdmissionsDocumentMetrics(
                documents.Count,
                documents.Count(x => x.Status == "Requested" || x.Status == "Under Review"),
                documents.Count(x =>
                    string.Equals(x.Status, "Verified", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(x.Status, "Delivered", StringComparison.OrdinalIgnoreCase))),
            new AdmissionsCommunicationMetrics(
                communications.Count,
                communications.Count(x => x.Channel == "Email"),
                communications.Count(x => x.Channel == "SMS"),
                communications.Count(x => x.Status == "Sent")),
            new AdmissionsReminderMetrics(
                reminders.Count,
                reminders.Count(x => x.Status == "Open"),
                reminders.Count(x => x.Status == "Completed")),
            automation);
    }
}

public sealed record AdmissionsWorkflowSummary(
    int Total,
    int NewItems,
    int InReview,
    AdmissionInquiry? Latest,
    AdmissionsApplicationMetrics Applications,
    AdmissionsCounselingMetrics Counseling,
    AdmissionsDocumentMetrics Documents,
    AdmissionsCommunicationMetrics Communications,
    AdmissionsReminderMetrics Reminders,
    AdmissionsAutomationMetrics Automation);

public sealed record AdmissionsApplicationMetrics(int Total, int Submitted, int UnderReview, int Qualified, int Offered);
public sealed record AdmissionsCounselingMetrics(int Total, int Scheduled, int Completed);
public sealed record AdmissionsDocumentMetrics(int Total, int Pending, int Verified);
public sealed record AdmissionsCommunicationMetrics(int Total, int Email, int Sms, int Sent);
public sealed record AdmissionsReminderMetrics(int Total, int Open, int Completed);
public sealed record HelpdeskTicketSummary(int Total, int Open, int InProgress, int Resolved, int HighPriority)
{
    public static HelpdeskTicketSummary Create(IReadOnlyCollection<HelpdeskTicket> tickets) =>
        new(
            tickets.Count,
            tickets.Count(x => string.Equals(x.Status, "Open", StringComparison.OrdinalIgnoreCase)),
            tickets.Count(x => string.Equals(x.Status, "In Progress", StringComparison.OrdinalIgnoreCase)),
            tickets.Count(x => string.Equals(x.Status, "Resolved", StringComparison.OrdinalIgnoreCase) || string.Equals(x.Status, "Closed", StringComparison.OrdinalIgnoreCase)),
            tickets.Count(x => string.Equals(x.Priority, "High", StringComparison.OrdinalIgnoreCase)));
}

public sealed record AdmissionsAutomationMetrics(int StaleApplications, int OverdueReminders, int PendingDocumentFollowUps, int EscalationsOpen)
{
    public static AdmissionsAutomationMetrics Create(
        IReadOnlyCollection<AdmissionApplication> applications,
        IReadOnlyCollection<ApplicationDocument> documents,
        IReadOnlyCollection<AdmissionCommunication> communications,
        IReadOnlyCollection<AdmissionReminder> reminders,
        DateTimeOffset nowUtc)
    {
        var staleApplications = applications.Count(application => AdmissionsAutomationRules.IsApplicationStale(application, communications, nowUtc));
        var overdueReminders = reminders.Count(reminder =>
            string.Equals(reminder.Status, "Open", StringComparison.OrdinalIgnoreCase) &&
            reminder.DueAtUtc <= nowUtc);
        var pendingDocumentFollowUps = documents.Count(document => AdmissionsAutomationRules.RequiresDocumentFollowUp(document, reminders, nowUtc));
        var escalationsOpen = reminders.Count(reminder =>
            string.Equals(reminder.Status, "Open", StringComparison.OrdinalIgnoreCase) &&
            reminder.ReminderType.Contains("Escalation", StringComparison.OrdinalIgnoreCase));

        return new AdmissionsAutomationMetrics(staleApplications, overdueReminders, pendingDocumentFollowUps, escalationsOpen);
    }
}

public static class AdmissionsAutomationRules
{
    public static bool IsApplicationStale(
        AdmissionApplication application,
        IReadOnlyCollection<AdmissionCommunication> communications,
        DateTimeOffset nowUtc)
    {
        if (!string.Equals(application.Status, "Submitted", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(application.Status, "Under Review", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (application.UpdatedAtUtc >= nowUtc.AddHours(-48))
        {
            return false;
        }

        var lastCommunication = communications
            .Where(item => item.ApplicationId == application.Id)
            .OrderByDescending(item => item.CreatedAtUtc)
            .FirstOrDefault();

        return lastCommunication is null || lastCommunication.CreatedAtUtc < nowUtc.AddHours(-48);
    }

    public static bool RequiresDocumentFollowUp(
        ApplicationDocument document,
        IReadOnlyCollection<AdmissionReminder> reminders,
        DateTimeOffset nowUtc)
    {
        if (!string.Equals(document.Status, "Requested", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(document.Status, "Under Review", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (document.RequestedAtUtc >= nowUtc.AddHours(-36))
        {
            return false;
        }

        return !reminders.Any(reminder =>
            reminder.ApplicationId == document.ApplicationId &&
            reminder.ReminderType.Contains(document.DocumentType, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(reminder.Status, "Open", StringComparison.OrdinalIgnoreCase));
    }
}

public static class AdmissionsAutomationEngine
{
    public static AdmissionsAutomationRunResult Run(
        string tenantId,
        IReadOnlyCollection<AdmissionApplication> applications,
        IReadOnlyCollection<ApplicationDocument> documents,
        IReadOnlyCollection<AdmissionCommunication> communications,
        IReadOnlyCollection<AdmissionReminder> reminders,
        DateTimeOffset nowUtc)
    {
        var createdReminders = new List<AdmissionReminder>();
        var createdNotifications = new List<Notification>();

        foreach (var application in applications.Where(application => AdmissionsAutomationRules.IsApplicationStale(application, communications, nowUtc)))
        {
            var hasOpenEscalation = reminders.Any(reminder =>
                reminder.ApplicationId == application.Id &&
                reminder.ReminderType.Contains("Escalation", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(reminder.Status, "Open", StringComparison.OrdinalIgnoreCase));

            if (hasOpenEscalation)
            {
                continue;
            }

            createdReminders.Add(new AdmissionReminder
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ApplicationId = application.Id,
                ApplicantName = application.ApplicantName,
                ReminderType = "Admissions Escalation",
                DueAtUtc = nowUtc.AddHours(4),
                Status = "Open",
                Notes = "Application has been inactive for more than 48 hours without a recent applicant follow-up.",
                CreatedAtUtc = nowUtc,
                UpdatedAtUtc = nowUtc
            });
        }

        foreach (var document in documents.Where(document => AdmissionsAutomationRules.RequiresDocumentFollowUp(document, reminders.Concat(createdReminders).ToArray(), nowUtc)))
        {
            createdReminders.Add(new AdmissionReminder
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ApplicationId = document.ApplicationId,
                ApplicantName = document.ApplicantName,
                ReminderType = $"{document.DocumentType} follow-up",
                DueAtUtc = nowUtc.AddHours(12),
                Status = "Open",
                Notes = "Automation queued a document follow-up because the checklist item has stayed pending beyond the SLA window.",
                CreatedAtUtc = nowUtc,
                UpdatedAtUtc = nowUtc
            });
        }

        if (createdReminders.Count > 0)
        {
            createdNotifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Title = "Admissions automation queued follow-up work",
                Message = $"{createdReminders.Count} reminders were created for stale applications or checklist delays.",
                Audience = "Admin",
                CreatedAtUtc = nowUtc,
                Source = "admissions-automation"
            });
        }

        var metrics = AdmissionsAutomationMetrics.Create(applications, documents, communications, reminders.Concat(createdReminders).ToArray(), nowUtc);
        return new AdmissionsAutomationRunResult(createdReminders, createdNotifications, metrics);
    }
}

public sealed record AdmissionsAutomationRunResult(
    IReadOnlyCollection<AdmissionReminder> CreatedReminders,
    IReadOnlyCollection<Notification> CreatedNotifications,
    AdmissionsAutomationMetrics Metrics);
