using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<StudentDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<StudentDbContext>();
await SeedAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "student-service", status = "ready" }));
app.MapGet("/api/v1/students", async (HttpContext httpContext, StudentDbContext db, string? search, string? department, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = db.Students.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(x => x.Name.Contains(search) || x.Email.Contains(search) || x.Batch.Contains(search));
    }

    if (!string.IsNullOrWhiteSpace(department))
    {
        query = query.Where(x => x.Department == department);
    }

    var total = await query.CountAsync();
    var items = await query.OrderBy(x => x.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
})
    .RequirePermissions("rbac.manage");
app.MapGet("/api/v1/students/{id:guid}", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Students.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == httpContext.GetValidatedTenantId()) is { } student ? Results.Ok(student) : Results.NotFound())
    .RequirePermissions("rbac.manage");
app.MapGet("/api/v1/students/{id:guid}/profile", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Students.Where(x => x.Id == id && x.TenantId == httpContext.GetValidatedTenantId()).Select(x => new { x.Id, x.Name, x.Department, x.Batch, x.Email, x.AcademicStatus }).FirstOrDefaultAsync() is { } profile ? Results.Ok(profile) : Results.NotFound())
    .RequirePermissions("rbac.manage");
app.MapGet("/api/v1/students/{id:guid}/enrollments", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
    await db.Enrollments.Where(x => x.StudentId == id && x.TenantId == httpContext.GetValidatedTenantId()).OrderByDescending(x => x.EnrolledAtUtc).ToListAsync())
    .RequirePermissions("results.view");

app.MapGet("/api/v1/students/{id:guid}/workspace", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, id))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var student = await db.Students.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (student is null)
    {
        return Results.NotFound();
    }

    var enrollments = await db.Enrollments
        .Where(x => x.StudentId == id && x.TenantId == tenantId)
        .OrderByDescending(x => x.EnrolledAtUtc)
        .ToListAsync();
    var requests = await db.ServiceRequests
        .Where(x => x.StudentId == id && x.TenantId == tenantId)
        .OrderByDescending(x => x.RequestedAtUtc)
        .ToListAsync();
    var workflowSteps = await db.RequestWorkflowSteps
        .Where(x => x.TenantId == tenantId && x.StudentId == id)
        .ToListAsync();

    return Results.Ok(StudentWorkspaceSummary.Create(student, enrollments, requests, workflowSteps));
}).RequireRoles("Student", "Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/students/{id:guid}/requests", async (Guid id, HttpContext httpContext, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, id))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await db.ServiceRequests
        .Where(x => x.StudentId == id && x.TenantId == tenantId)
        .OrderByDescending(x => x.RequestedAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Student", "Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/students/{studentId:guid}/requests/{requestId:guid}/delivery", async (Guid studentId, Guid requestId, HttpContext httpContext, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, studentId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var serviceRequest = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.StudentId == studentId && x.TenantId == tenantId);
    if (serviceRequest is null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(serviceRequest.DeliveryChannel) || string.IsNullOrWhiteSpace(serviceRequest.DownloadUrl))
    {
        return Results.BadRequest(new { message = "This request does not have a delivery package yet." });
    }

    return Results.Ok(new
    {
        requestId = serviceRequest.Id,
        serviceRequest.RequestType,
        serviceRequest.FulfillmentReference,
        serviceRequest.DeliveryChannel,
        serviceRequest.DownloadUrl,
        serviceRequest.DeliveredAtUtc
    });
}).RequireRoles("Student", "Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/students/{studentId:guid}/requests/{requestId:guid}/journey", async (Guid studentId, Guid requestId, HttpContext httpContext, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, studentId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var serviceRequest = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.StudentId == studentId && x.TenantId == tenantId);
    if (serviceRequest is null)
    {
        return Results.NotFound();
    }

    var steps = await db.RequestWorkflowSteps
        .Where(x => x.TenantId == tenantId && x.RequestId == requestId)
        .OrderBy(x => x.SortOrder)
        .ToListAsync();
    var activities = await db.RequestActivities
        .Where(x => x.TenantId == tenantId && x.RequestId == requestId)
        .OrderByDescending(x => x.CreatedAtUtc)
        .Take(8)
        .ToListAsync();

    return Results.Ok(StudentRequestJourney.Create(serviceRequest, steps, activities));
}).RequireRoles("Student", "Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/requests/summary", async (HttpContext httpContext, StudentDbContext db) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var requests = await db.ServiceRequests.Where(x => x.TenantId == tenantId).ToListAsync();
    var workflowSteps = await db.RequestWorkflowSteps.Where(x => x.TenantId == tenantId).ToListAsync();
    return Results.Ok(StudentRequestSummary.Create(requests, workflowSteps));
}).RequireRoles("Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/requests", async (HttpContext httpContext, StudentDbContext db, string? status, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 100);
    var query = db.ServiceRequests.Where(x => x.TenantId == tenantId);
    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(x => x.Status == status);
    }

    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.RequestedAtUtc).Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { items, page = safePage, pageSize = safePageSize, total });
}).RequireRoles("Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/students/{id:guid}/requests", async (Guid id, HttpContext httpContext, [FromBody] CreateStudentRequest request, StudentDbContext db) =>
{
    if (!StudentAccessPolicy.CanAccessStudentWorkspace(httpContext, id))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.RequestType) || string.IsNullOrWhiteSpace(request.Title))
    {
        return Results.BadRequest(new { message = "Request type and title are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var student = await db.Students.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (student is null)
    {
        return Results.NotFound();
    }

    var serviceRequest = new StudentServiceRequest
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = id,
        RequestType = request.RequestType.Trim(),
        Title = request.Title.Trim(),
        Description = request.Description?.Trim() ?? string.Empty,
        Status = "Submitted",
        AssignedTo = request.AssignedTo?.Trim() ?? "Student Services Desk",
        RequestedAtUtc = DateTimeOffset.UtcNow
    };

    db.ServiceRequests.Add(serviceRequest);
    var workflowSteps = StudentRequestWorkflowFactory.Build(serviceRequest);
    db.RequestWorkflowSteps.AddRange(workflowSteps);
    db.RequestActivities.Add(StudentRequestActivity.Create(
        tenantId,
        serviceRequest.StudentId,
        serviceRequest.Id,
        "Request Received",
        "Completed",
        httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? student.Email,
        $"{serviceRequest.RequestType} request submitted and routed for review.",
        serviceRequest.RequestedAtUtc));
    db.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "student.request.created",
        EntityId = serviceRequest.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? student.Email,
        Details = $"{serviceRequest.RequestType}:{serviceRequest.Title}",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/students/{id}/requests/{serviceRequest.Id}", serviceRequest);
}).RequireRoles("Student", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/requests/{id:guid}/status", async (Guid id, HttpContext httpContext, [FromBody] UpdateStudentRequestStatusRequest request, StudentDbContext db) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var serviceRequest = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
    if (serviceRequest is null)
    {
        return Results.NotFound();
    }

    serviceRequest.Status = request.Status.Trim();
    serviceRequest.AssignedTo = request.AssignedTo?.Trim() ?? serviceRequest.AssignedTo;
    serviceRequest.ResolutionNote = request.ResolutionNote?.Trim() ?? serviceRequest.ResolutionNote;
    serviceRequest.FulfillmentReference = request.FulfillmentReference?.Trim() ?? serviceRequest.FulfillmentReference;
    serviceRequest.ResolvedAtUtc = request.Status is "Approved" or "Fulfilled" ? DateTimeOffset.UtcNow : serviceRequest.ResolvedAtUtc;
    if (string.Equals(serviceRequest.Status, "Fulfilled", StringComparison.OrdinalIgnoreCase))
    {
        serviceRequest.DeliveryChannel = string.IsNullOrWhiteSpace(request.DeliveryChannel) ? "Portal Download" : request.DeliveryChannel.Trim();
        serviceRequest.DownloadUrl = string.IsNullOrWhiteSpace(request.DownloadUrl)
            ? $"https://student-documents.university360.local/download/{serviceRequest.Id:N}?ref={Uri.EscapeDataString(serviceRequest.FulfillmentReference)}"
            : request.DownloadUrl.Trim();
        serviceRequest.DeliveredAtUtc ??= DateTimeOffset.UtcNow;
    }

    db.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "student.request.status-updated",
        EntityId = serviceRequest.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "student-services",
        Details = $"{serviceRequest.RequestType}:{serviceRequest.Status}",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Ok(serviceRequest);
}).RequireRoles("Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/requests/{requestId:guid}/workflow/{stepId:guid}/status", async (Guid requestId, Guid stepId, HttpContext httpContext, [FromBody] UpdateStudentRequestWorkflowStepStatusRequest request, StudentDbContext db) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var serviceRequest = await db.ServiceRequests.FirstOrDefaultAsync(x => x.Id == requestId && x.TenantId == tenantId);
    if (serviceRequest is null)
    {
        return Results.NotFound();
    }

    var step = await db.RequestWorkflowSteps.FirstOrDefaultAsync(x => x.Id == stepId && x.RequestId == requestId && x.TenantId == tenantId);
    if (step is null)
    {
        return Results.NotFound();
    }

    step.Status = request.Status.Trim();
    step.OwnerName = string.IsNullOrWhiteSpace(request.OwnerName) ? step.OwnerName : request.OwnerName.Trim();
    step.Note = string.IsNullOrWhiteSpace(request.Note) ? step.Note : request.Note.Trim();
    step.CompletedAtUtc = StudentRequestWorkflowFactory.IsCompletedStatus(step.Status) ? DateTimeOffset.UtcNow : null;

    var actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "student-services";
    db.RequestActivities.Add(StudentRequestActivity.Create(
        tenantId,
        serviceRequest.StudentId,
        serviceRequest.Id,
        step.StepName,
        step.Status,
        actor,
        string.IsNullOrWhiteSpace(step.Note) ? $"Step updated to {step.Status}." : step.Note));

    var allSteps = await db.RequestWorkflowSteps
        .Where(x => x.RequestId == requestId && x.TenantId == tenantId)
        .OrderBy(x => x.SortOrder)
        .ToListAsync();

    StudentRequestWorkflowFactory.ApplyStatusFromWorkflow(serviceRequest, allSteps, request.DeliveryChannel, request.DownloadUrl);

    db.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "student.request.workflow-step.updated",
        EntityId = step.Id.ToString(),
        Actor = actor,
        Details = $"{serviceRequest.RequestType}:{step.StepName}:{step.Status}",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });

    await db.SaveChangesAsync();

    var activities = await db.RequestActivities
        .Where(x => x.TenantId == tenantId && x.RequestId == requestId)
        .OrderByDescending(x => x.CreatedAtUtc)
        .Take(8)
        .ToListAsync();

    return Results.Ok(StudentRequestJourney.Create(serviceRequest, allSteps, activities));
}).RequireRoles("Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/enrollments", async (HttpContext httpContext, [FromBody] EnrollmentRequest request, StudentDbContext db) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var exists = await db.Enrollments.AnyAsync(x =>
        x.TenantId == tenantId &&
        x.StudentId == request.StudentId &&
        x.CourseCode == request.CourseCode &&
        x.SemesterCode == request.SemesterCode);
    if (exists)
    {
        return Results.Conflict(new { message = "Enrollment already exists for this student, course, and semester." });
    }

    var enrollment = new StudentEnrollment
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = request.StudentId,
        CourseCode = request.CourseCode,
        SemesterCode = request.SemesterCode,
        Status = request.Status,
        EnrolledAtUtc = DateTimeOffset.UtcNow
    };

    db.Enrollments.Add(enrollment);
    db.AuditLogs.Add(new AuditLogEntry
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Action = "student.enrollment.created",
        EntityId = enrollment.Id.ToString(),
        Actor = httpContext.User.Identity?.Name ?? httpContext.User.FindFirst("role")?.Value ?? "unknown",
        Details = $"{request.StudentId}:{request.CourseCode}:{request.SemesterCode}",
        CreatedAtUtc = DateTimeOffset.UtcNow
    });
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/enrollments/{enrollment.Id}", enrollment);
}).RequirePermissions("rbac.manage");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, StudentDbContext db, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = db.AuditLogs.Where(x => x.TenantId == tenantId);
    var total = await query.CountAsync();
    var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("rbac.manage");

app.Run();

static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<StudentDbContext>();
    if (!await db.Students.AnyAsync())
    {
        db.Students.Add(new StudentRecord { Id = Guid.Parse("00000000-0000-0000-0000-000000000123"), TenantId = "default", Name = "Aarav Sharma", Department = "Computer Science", Batch = "2022", Email = "student@university360.edu", AcademicStatus = "Active" });
    }

    if (!await db.Enrollments.AnyAsync())
    {
        db.Enrollments.Add(new StudentEnrollment
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
            CourseCode = "CSE401",
            SemesterCode = "2026-SPRING",
            Status = "Enrolled",
            EnrolledAtUtc = DateTimeOffset.UtcNow.AddDays(-20)
        });
        db.Enrollments.Add(new StudentEnrollment
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
            CourseCode = "PHY201",
            SemesterCode = "2026-SPRING",
            Status = "Enrolled",
            EnrolledAtUtc = DateTimeOffset.UtcNow.AddDays(-20)
        });
        db.Enrollments.Add(new StudentEnrollment
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
            CourseCode = "MTH301",
            SemesterCode = "2026-SPRING",
            Status = "Enrolled",
            EnrolledAtUtc = DateTimeOffset.UtcNow.AddDays(-20)
        });
    }

    if (!await db.ServiceRequests.AnyAsync())
    {
        db.ServiceRequests.AddRange(
        [
            new StudentServiceRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
                RequestType = "Bonafide Letter",
                Title = "Need bonafide letter for internship verification",
                Description = "Request raised for the internship onboarding packet.",
                Status = "Submitted",
                AssignedTo = "Student Services Desk",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new StudentServiceRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
                RequestType = "Leave Request",
                Title = "Medical leave for lab session",
                Description = "Attendance consideration requested with medical note.",
                Status = "In Review",
                AssignedTo = "Department Office",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            },
            new StudentServiceRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"),
                RequestType = "Transcript Certificate",
                Title = "Official transcript for graduate application",
                Description = "Certificate request is approved and ready for pickup.",
                Status = "Fulfilled",
                AssignedTo = "Examination Cell",
                ResolutionNote = "Printed transcript is available at the examination counter.",
                FulfillmentReference = "CERT-2026-1004",
                DeliveryChannel = "Portal Download",
                DownloadUrl = "https://student-documents.university360.local/download/transcript/CERT-2026-1004",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-6),
                ResolvedAtUtc = DateTimeOffset.UtcNow.AddDays(-4),
                DeliveredAtUtc = DateTimeOffset.UtcNow.AddDays(-4)
            }
        ]);
    }

    await db.SaveChangesAsync();

    if (!await db.RequestWorkflowSteps.AnyAsync())
    {
        var requests = await db.ServiceRequests.Where(x => x.TenantId == "default").ToListAsync();
        db.RequestWorkflowSteps.AddRange(requests.SelectMany(StudentRequestWorkflowFactory.Build));
    }

    if (!await db.RequestActivities.AnyAsync())
    {
        var requests = await db.ServiceRequests.Where(x => x.TenantId == "default").ToListAsync();
        db.RequestActivities.AddRange(requests.Select(item =>
            StudentRequestActivity.Create(
                item.TenantId,
                item.StudentId,
                item.Id,
                "Request Received",
                "Completed",
                item.AssignedTo,
                $"{item.RequestType} request entered the student services queue.",
                item.RequestedAtUtc)));
    }

    await db.SaveChangesAsync();
}

public sealed record EnrollmentRequest(string TenantId, Guid StudentId, string CourseCode, string SemesterCode, string Status);
public sealed record CreateStudentRequest(string TenantId, string RequestType, string Title, string? Description, string? AssignedTo = null);
public sealed record UpdateStudentRequestStatusRequest(string Status, string? ResolutionNote, string? FulfillmentReference, string? AssignedTo, string? DeliveryChannel = null, string? DownloadUrl = null);
public sealed record UpdateStudentRequestWorkflowStepStatusRequest(string Status, string? Note, string? OwnerName, string? DeliveryChannel = null, string? DownloadUrl = null);
public sealed record StudentRequestSummary(
    int Total,
    int Submitted,
    int InReview,
    int Approved,
    int Fulfilled,
    int CertificateRequests,
    int ReadyForDownload,
    int AwaitingPaymentClearance)
{
    public static StudentRequestSummary Create(IReadOnlyCollection<StudentServiceRequest> requests, IReadOnlyCollection<StudentRequestWorkflowStep> workflowSteps) =>
        new(
            requests.Count,
            requests.Count(item => item.Status == "Submitted"),
            requests.Count(item => item.Status == "In Review"),
            requests.Count(item => item.Status == "Approved"),
            requests.Count(item => item.Status == "Fulfilled"),
            requests.Count(item => item.RequestType.Contains("Letter", StringComparison.OrdinalIgnoreCase) || item.RequestType.Contains("Certificate", StringComparison.OrdinalIgnoreCase)),
            requests.Count(item => !string.IsNullOrWhiteSpace(item.DownloadUrl)),
            workflowSteps.Count(item => string.Equals(item.StepKind, "PaymentClearance", StringComparison.OrdinalIgnoreCase) && !StudentRequestWorkflowFactory.IsCompletedStatus(item.Status)));
}

public sealed class StudentRecord
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Name { get; set; } = "";
    public string Department { get; set; } = "";
    public string Batch { get; set; } = "";
    public string Email { get; set; } = "";
    public string AcademicStatus { get; set; } = "";
}

public sealed class StudentEnrollment
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public string CourseCode { get; set; } = "";
    public string SemesterCode { get; set; } = "";
    public string Status { get; set; } = "Enrolled";
    public DateTimeOffset EnrolledAtUtc { get; set; }
}

public sealed class StudentServiceRequest
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public string RequestType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Submitted";
    public string AssignedTo { get; set; } = string.Empty;
    public string ResolutionNote { get; set; } = string.Empty;
    public string FulfillmentReference { get; set; } = string.Empty;
    public string DeliveryChannel { get; set; } = string.Empty;
    public string DownloadUrl { get; set; } = string.Empty;
    public DateTimeOffset RequestedAtUtc { get; set; }
    public DateTimeOffset? ResolvedAtUtc { get; set; }
    public DateTimeOffset? DeliveredAtUtc { get; set; }
}

public sealed class StudentRequestWorkflowStep
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public Guid RequestId { get; set; }
    public int SortOrder { get; set; }
    public string StepName { get; set; } = string.Empty;
    public string StepKind { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string OwnerName { get; set; } = string.Empty;
    public DateTimeOffset DueAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public string Note { get; set; } = string.Empty;
}

public sealed class StudentRequestActivity
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public Guid RequestId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    public static StudentRequestActivity Create(
        string tenantId,
        Guid studentId,
        Guid requestId,
        string stageName,
        string status,
        string actorName,
        string message,
        DateTimeOffset? createdAtUtc = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StudentId = studentId,
            RequestId = requestId,
            StageName = stageName,
            Status = status,
            ActorName = actorName,
            Message = message,
            CreatedAtUtc = createdAtUtc ?? DateTimeOffset.UtcNow
        };
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

public sealed class StudentDbContext(DbContextOptions<StudentDbContext> options) : DbContext(options)
{
    public DbSet<StudentRecord> Students => Set<StudentRecord>();
    public DbSet<StudentEnrollment> Enrollments => Set<StudentEnrollment>();
    public DbSet<StudentServiceRequest> ServiceRequests => Set<StudentServiceRequest>();
    public DbSet<StudentRequestWorkflowStep> RequestWorkflowSteps => Set<StudentRequestWorkflowStep>();
    public DbSet<StudentRequestActivity> RequestActivities => Set<StudentRequestActivity>();
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
}

public sealed record StudentWorkspaceSummary(
    Guid StudentId,
    string Name,
    string Department,
    string Batch,
    string AcademicStatus,
    int EnrollmentCount,
    int OpenRequests,
    int ReadyForDownload,
    int RequestsAwaitingClearance,
    StudentEnrollment[] RecentEnrollments,
    StudentServiceRequest[] RecentRequests)
{
    public static StudentWorkspaceSummary Create(
        StudentRecord student,
        IReadOnlyCollection<StudentEnrollment> enrollments,
        IReadOnlyCollection<StudentServiceRequest> requests,
        IReadOnlyCollection<StudentRequestWorkflowStep> workflowSteps) =>
        new(
            student.Id,
            student.Name,
            student.Department,
            student.Batch,
            student.AcademicStatus,
            enrollments.Count,
            requests.Count(item => item.Status == "Submitted" || item.Status == "In Review"),
            requests.Count(item => !string.IsNullOrWhiteSpace(item.DownloadUrl)),
            workflowSteps.Count(item => string.Equals(item.StepKind, "PaymentClearance", StringComparison.OrdinalIgnoreCase) && !StudentRequestWorkflowFactory.IsCompletedStatus(item.Status)),
            enrollments.Take(4).ToArray(),
            requests.Take(4).ToArray());
}

public sealed record StudentRequestJourney(
    Guid RequestId,
    Guid StudentId,
    string RequestType,
    string Title,
    string Status,
    string AssignedTo,
    int CompletedSteps,
    int TotalSteps,
    string CurrentStep,
    string NextAction,
    bool ReadyForDownload,
    bool WaitingOnPayment,
    StudentRequestWorkflowStep[] Steps,
    StudentRequestActivity[] Activities)
{
    public static StudentRequestJourney Create(
        StudentServiceRequest request,
        IReadOnlyCollection<StudentRequestWorkflowStep> steps,
        IReadOnlyCollection<StudentRequestActivity> activities)
    {
        var orderedSteps = steps.OrderBy(x => x.SortOrder).ToArray();
        var completedSteps = orderedSteps.Count(item => StudentRequestWorkflowFactory.IsCompletedStatus(item.Status));
        var currentStep = orderedSteps.FirstOrDefault(item => !StudentRequestWorkflowFactory.IsCompletedStatus(item.Status))?.StepName
            ?? orderedSteps.LastOrDefault()?.StepName
            ?? "Request received";
        var waitingOnPayment = orderedSteps.Any(item =>
            string.Equals(item.StepKind, "PaymentClearance", StringComparison.OrdinalIgnoreCase)
            && !StudentRequestWorkflowFactory.IsCompletedStatus(item.Status));
        var nextAction = waitingOnPayment
            ? "Clear the payment step so the request can move into preparation."
            : string.IsNullOrWhiteSpace(request.DownloadUrl)
                ? $"Next step: {currentStep}."
                : "Download is ready in the student account.";

        return new StudentRequestJourney(
            request.Id,
            request.StudentId,
            request.RequestType,
            request.Title,
            request.Status,
            request.AssignedTo,
            completedSteps,
            orderedSteps.Length,
            currentStep,
            nextAction,
            !string.IsNullOrWhiteSpace(request.DownloadUrl),
            waitingOnPayment,
            orderedSteps,
            activities.OrderByDescending(x => x.CreatedAtUtc).ToArray());
    }
}

public static class StudentRequestWorkflowFactory
{
    public static StudentRequestWorkflowStep[] Build(StudentServiceRequest request)
    {
        var templates = GetTemplates(request).ToArray();
        return templates
            .Select((template, index) => new StudentRequestWorkflowStep
            {
                Id = Guid.NewGuid(),
                TenantId = request.TenantId,
                StudentId = request.StudentId,
                RequestId = request.Id,
                SortOrder = index + 1,
                StepName = template.StepName,
                StepKind = template.StepKind,
                Status = template.InitialStatus,
                OwnerName = template.OwnerName,
                DueAtUtc = request.RequestedAtUtc.AddDays(template.DueOffsetDays),
                CompletedAtUtc = IsCompletedStatus(template.InitialStatus) ? request.RequestedAtUtc : null,
                Note = template.Note
            })
            .ToArray();
    }

    public static bool IsCompletedStatus(string status) =>
        string.Equals(status, "Completed", StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, "Approved", StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, "Delivered", StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, "Ready", StringComparison.OrdinalIgnoreCase);

    public static void ApplyStatusFromWorkflow(StudentServiceRequest request, IReadOnlyCollection<StudentRequestWorkflowStep> steps, string? deliveryChannel, string? downloadUrl)
    {
        var deliveryStep = steps.FirstOrDefault(item => string.Equals(item.StepKind, "Delivery", StringComparison.OrdinalIgnoreCase));
        var approvalStep = steps.FirstOrDefault(item => string.Equals(item.StepKind, "Approval", StringComparison.OrdinalIgnoreCase));
        var activeStep = steps.FirstOrDefault(item => !IsCompletedStatus(item.Status));

        request.AssignedTo = activeStep?.OwnerName ?? request.AssignedTo;

        if (deliveryStep is not null && IsCompletedStatus(deliveryStep.Status))
        {
            request.Status = "Fulfilled";
            request.ResolvedAtUtc ??= DateTimeOffset.UtcNow;
            request.DeliveryChannel = string.IsNullOrWhiteSpace(deliveryChannel) ? "Portal Download" : deliveryChannel.Trim();
            request.DownloadUrl = string.IsNullOrWhiteSpace(downloadUrl)
                ? $"https://student-documents.university360.local/download/{request.Id:N}"
                : downloadUrl.Trim();
            request.DeliveredAtUtc ??= DateTimeOffset.UtcNow;
            return;
        }

        if (approvalStep is not null && IsCompletedStatus(approvalStep.Status))
        {
            request.Status = "Approved";
            request.ResolvedAtUtc ??= DateTimeOffset.UtcNow;
            return;
        }

        request.Status = activeStep is null ? "Approved" : "In Review";
    }

    private static IEnumerable<StudentRequestWorkflowTemplate> GetTemplates(StudentServiceRequest request)
    {
        yield return new StudentRequestWorkflowTemplate("Request Received", "Intake", "Student Services Desk", "Completed", 0, "The request was logged and routed.");

        if (request.RequestType.Contains("Transcript", StringComparison.OrdinalIgnoreCase)
            || request.RequestType.Contains("Certificate", StringComparison.OrdinalIgnoreCase))
        {
            yield return new StudentRequestWorkflowTemplate("Examination review", "Review", "Examination Cell", "Pending", 1, "Academic records are being validated.");
            yield return new StudentRequestWorkflowTemplate("Payment clearance", "PaymentClearance", "Finance Office", "Pending", 2, "Outstanding dues need finance confirmation.");
            yield return new StudentRequestWorkflowTemplate("Document preparation", "Preparation", "Document Desk", "Pending", 3, "The document is being generated.");
            yield return new StudentRequestWorkflowTemplate("Digital delivery", "Delivery", "Student Services Desk", "Pending", 4, "Final file will be released in the student page.");
            yield break;
        }

        if (request.RequestType.Contains("Fee", StringComparison.OrdinalIgnoreCase))
        {
            yield return new StudentRequestWorkflowTemplate("Finance desk review", "Review", "Finance Office", "Pending", 1, "Fee schedule and ledger are being checked.");
            yield return new StudentRequestWorkflowTemplate("Decision approval", "Approval", "Accounts Supervisor", "Pending", 2, "The review outcome is awaiting approval.");
            yield return new StudentRequestWorkflowTemplate("Student update", "Delivery", "Finance Office", "Pending", 3, "The fee clarification will be shared in the student page.");
            yield break;
        }

        if (request.RequestType.Contains("Leave", StringComparison.OrdinalIgnoreCase))
        {
            yield return new StudentRequestWorkflowTemplate("Department review", "Review", "Department Office", "Pending", 1, "Class and attendance impact is under review.");
            yield return new StudentRequestWorkflowTemplate("Attendance check", "Approval", "Faculty Advisor", "Pending", 2, "The attendance decision is being confirmed.");
            yield return new StudentRequestWorkflowTemplate("Student confirmation", "Delivery", "Department Office", "Pending", 3, "The final leave decision will be shared in the student page.");
            yield break;
        }

        yield return new StudentRequestWorkflowTemplate("Service review", "Review", request.AssignedTo, "Pending", 1, "The request is being validated by the service desk.");
        yield return new StudentRequestWorkflowTemplate("Approval", "Approval", request.AssignedTo, "Pending", 2, "Approval is in progress.");
        yield return new StudentRequestWorkflowTemplate("Delivery", "Delivery", request.AssignedTo, "Pending", 3, "The final response will be posted here.");
    }
}

public sealed record StudentRequestWorkflowTemplate(string StepName, string StepKind, string OwnerName, string InitialStatus, int DueOffsetDays, string Note);

public static class StudentAccessPolicy
{
    public static bool CanAccessStudentWorkspace(HttpContext httpContext, Guid requestedUserId)
    {
        var role = httpContext.User.FindFirst("role")?.Value
            ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
            ?? string.Empty;

        if (new[] { "Professor", "Principal", "Admin", "DepartmentHead" }.Contains(role, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        var currentUserId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.User.FindFirst("sub")?.Value;

        return Guid.TryParse(currentUserId, out var parsedUserId) && parsedUserId == requestedUserId;
    }
}
