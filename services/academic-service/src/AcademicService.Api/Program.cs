using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<AcademicDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<AcademicDbContext>();
await SeedAcademicDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "academic-service", status = "ready" }));

app.MapPost("/api/v1/courses", async (HttpContext httpContext, [FromBody] CreateCourseRequest request, AcademicDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var course = new Course
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        CourseCode = request.CourseCode,
        Title = request.Title,
        Credits = request.Credits,
        SemesterCode = request.SemesterCode,
        FacultyId = request.FacultyId,
        DayOfWeek = request.DayOfWeek,
        StartTime = request.StartTime,
        Room = request.Room
    };

    dbContext.Courses.Add(course);
    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.course.created", course.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"Course {course.CourseCode} created for {course.SemesterCode}."));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/courses/{course.Id}", course);
}).RequirePermissions("rbac.manage").RequireRateLimiting("api");

app.MapGet("/api/v1/courses", async (HttpContext httpContext, AcademicDbContext dbContext, string? search, string? semesterCode, Guid? facultyId, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    page = Math.Max(page, 1);
    pageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.Courses.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(x => x.CourseCode.Contains(search) || x.Title.Contains(search) || x.Room.Contains(search));
    }

    if (!string.IsNullOrWhiteSpace(semesterCode))
    {
        query = query.Where(x => x.SemesterCode == semesterCode);
    }

    if (facultyId.HasValue)
    {
        query = query.Where(x => x.FacultyId == facultyId.Value);
    }

    var total = await query.CountAsync();
    var items = await query.OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
    return Results.Ok(new { items, page, pageSize, total });
}).RequirePermissions("results.view");

app.MapGet("/api/v1/dashboard/summary", async (HttpContext httpContext, AcademicDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var nextCourse = await dbContext.Courses.Where(x => x.TenantId == tenantId).OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).FirstOrDefaultAsync();
    var totalCourses = await dbContext.Courses.CountAsync(x => x.TenantId == tenantId);

    return Results.Ok(new
    {
        totalCourses,
        nextCourse
    });
}).RequirePermissions("results.view");

app.MapGet("/api/v1/teachers/{teacherId:guid}/summary", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var courses = await dbContext.Courses
        .Where(x => x.TenantId == tenantId && x.FacultyId == teacherId)
        .OrderBy(x => x.DayOfWeek)
        .ThenBy(x => x.StartTime)
        .ToListAsync();
    var officeHours = await dbContext.OfficeHours.Where(x => x.TenantId == tenantId && x.TeacherId == teacherId).ToListAsync();
    var substitutionRequests = await dbContext.SubstitutionRequests.Where(x => x.TenantId == tenantId && x.TeacherId == teacherId).ToListAsync();
    var coursePlans = await dbContext.CoursePlans.Where(x => x.TenantId == tenantId && x.TeacherId == teacherId).ToListAsync();
    var advisingNotes = await dbContext.AdvisingNotes.Where(x => x.TenantId == tenantId && x.TeacherId == teacherId).ToListAsync();
    var timetableChanges = await dbContext.TimetableChangeRequests.Where(x => x.TenantId == tenantId && x.TeacherId == teacherId).ToListAsync();
    var mentoringRoster = await dbContext.MentoringAssignments.Where(x => x.TenantId == tenantId && x.TeacherId == teacherId).ToListAsync();
    var facultyAdministration = FacultyAdministrationSummary.Create(officeHours, substitutionRequests, coursePlans, advisingNotes, timetableChanges, mentoringRoster);

    return Results.Ok(new
    {
        totalCourses = courses.Count,
        nextCourse = courses.FirstOrDefault(),
        teachingLoad = courses.Select(x => x.CourseCode).Distinct().Count(),
        officeHoursScheduled = facultyAdministration.OfficeHoursScheduled,
        pendingClassCoverRequests = facultyAdministration.PendingClassCoverRequests,
        coursePlansAwaitingApproval = facultyAdministration.CoursePlansAwaitingApproval,
        approvedCoursePlans = facultyAdministration.ApprovedCoursePlans,
        adviseeFollowUpsOpen = facultyAdministration.AdviseeFollowUpsOpen,
        pendingTimetableChanges = facultyAdministration.PendingTimetableChanges,
        mentoringStudents = facultyAdministration.MentoringStudents,
        mentoringAlerts = facultyAdministration.MentoringAlerts
    });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/advising-notes", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.AdvisingNotes
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderByDescending(x => x.CreatedAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/advising-notes", async (Guid teacherId, HttpContext httpContext, [FromBody] CreateAdvisingNoteRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.StudentName) || string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Note))
    {
        return Results.BadRequest(new { message = "Student name, title, and note are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var entry = new AdvisingNote
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        TeacherId = teacherId,
        StudentName = request.StudentName.Trim(),
        CourseCode = request.CourseCode?.Trim() ?? string.Empty,
        Title = request.Title.Trim(),
        Note = request.Note.Trim(),
        FollowUpStatus = request.FollowUpStatus?.Trim() ?? "Open",
        CreatedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.AdvisingNotes.Add(entry);
    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.advising-note.created", entry.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"{entry.StudentName}:{entry.Title}"));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/teachers/{teacherId}/advising-notes/{entry.Id}", entry);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/office-hours", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.OfficeHours
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderBy(x => x.DayOfWeek)
        .ThenBy(x => x.StartTime)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/office-hours", async (Guid teacherId, HttpContext httpContext, [FromBody] CreateOfficeHourRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.CourseCode) || string.IsNullOrWhiteSpace(request.DayOfWeek) || string.IsNullOrWhiteSpace(request.StartTime) || string.IsNullOrWhiteSpace(request.EndTime) || string.IsNullOrWhiteSpace(request.Location))
    {
        return Results.BadRequest(new { message = "Course, day, time, and location are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var entry = new FacultyOfficeHour
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        TeacherId = teacherId,
        CourseCode = request.CourseCode.Trim(),
        DayOfWeek = request.DayOfWeek.Trim(),
        StartTime = request.StartTime.Trim(),
        EndTime = request.EndTime.Trim(),
        Location = request.Location.Trim(),
        DeliveryMode = string.IsNullOrWhiteSpace(request.DeliveryMode) ? "In Person" : request.DeliveryMode.Trim(),
        Status = string.IsNullOrWhiteSpace(request.Status) ? "Scheduled" : request.Status.Trim(),
        CreatedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.OfficeHours.Add(entry);
    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.office-hour.created", entry.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"{entry.CourseCode}:{entry.DayOfWeek} {entry.StartTime}"));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/teachers/{teacherId}/office-hours/{entry.Id}", entry);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/substitution-requests", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.SubstitutionRequests
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderByDescending(x => x.RequestedAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/substitution-requests", async (Guid teacherId, HttpContext httpContext, [FromBody] CreateSubstitutionRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.CourseCode) || string.IsNullOrWhiteSpace(request.Reason))
    {
        return Results.BadRequest(new { message = "Course and reason are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var entry = new FacultySubstitutionRequest
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        TeacherId = teacherId,
        CourseCode = request.CourseCode.Trim(),
        ClassDateUtc = request.ClassDateUtc,
        Reason = request.Reason.Trim(),
        RequestedCoverTeacher = request.RequestedCoverTeacher?.Trim() ?? string.Empty,
        Status = string.IsNullOrWhiteSpace(request.Status) ? "Pending" : request.Status.Trim(),
        AdminNote = request.AdminNote?.Trim() ?? string.Empty,
        RequestedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.SubstitutionRequests.Add(entry);
    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.class-cover-request.created", entry.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"{entry.CourseCode}:{entry.Status}"));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/teachers/{teacherId}/substitution-requests/{entry.Id}", entry);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/substitution-requests/{requestId:guid}/status", async (Guid teacherId, Guid requestId, HttpContext httpContext, [FromBody] UpdateSubstitutionRequestStatusRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    if (string.IsNullOrWhiteSpace(request.Status))
    {
        return Results.BadRequest(new { message = "Status is required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.SubstitutionRequests.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.TeacherId == teacherId && x.Id == requestId);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status.Trim();
    item.AdminNote = request.AdminNote?.Trim() ?? item.AdminNote;
    item.RequestedCoverTeacher = request.RequestedCoverTeacher?.Trim() ?? item.RequestedCoverTeacher;
    item.ReviewedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.class-cover-request.updated", item.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", item.Status));
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/course-plans", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.CoursePlans
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderByDescending(x => x.UpdatedAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/course-plans", async (Guid teacherId, HttpContext httpContext, [FromBody] CreateCoursePlanRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.CourseCode) || string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Coverage))
    {
        return Results.BadRequest(new { message = "Course, title, and coverage are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var nowUtc = DateTimeOffset.UtcNow;
    var entry = new FacultyCoursePlan
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        TeacherId = teacherId,
        CourseCode = request.CourseCode.Trim(),
        Title = request.Title.Trim(),
        Coverage = request.Coverage.Trim(),
        Status = string.IsNullOrWhiteSpace(request.Status) ? "Draft" : request.Status.Trim(),
        ReviewNote = request.ReviewNote?.Trim() ?? string.Empty,
        UpdatedAtUtc = nowUtc,
        SubmittedAtUtc = string.Equals(request.Status, "Submitted", StringComparison.OrdinalIgnoreCase) ? nowUtc : null,
        ApprovedAtUtc = string.Equals(request.Status, "Approved", StringComparison.OrdinalIgnoreCase) ? nowUtc : null
    };

    dbContext.CoursePlans.Add(entry);
    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.course-plan.created", entry.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"{entry.CourseCode}:{entry.Status}"));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/teachers/{teacherId}/course-plans/{entry.Id}", entry);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/course-plans/{coursePlanId:guid}/status", async (Guid teacherId, Guid coursePlanId, HttpContext httpContext, [FromBody] UpdateCoursePlanStatusRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    if (string.IsNullOrWhiteSpace(request.Status))
    {
        return Results.BadRequest(new { message = "Status is required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.CoursePlans.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.TeacherId == teacherId && x.Id == coursePlanId);
    if (item is null)
    {
        return Results.NotFound();
    }

    var nowUtc = DateTimeOffset.UtcNow;
    item.Status = request.Status.Trim();
    item.ReviewNote = request.ReviewNote?.Trim() ?? item.ReviewNote;
    item.UpdatedAtUtc = nowUtc;
    if (string.Equals(item.Status, "Submitted", StringComparison.OrdinalIgnoreCase))
    {
        item.SubmittedAtUtc ??= nowUtc;
    }

    if (string.Equals(item.Status, "Approved", StringComparison.OrdinalIgnoreCase))
    {
        item.ApprovedAtUtc = nowUtc;
    }

    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.course-plan.updated", item.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", item.Status));
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/timetable-change-requests", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.TimetableChangeRequests
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderByDescending(x => x.RequestedAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/timetable-change-requests", async (Guid teacherId, HttpContext httpContext, [FromBody] CreateTimetableChangeRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    if (string.IsNullOrWhiteSpace(request.CourseCode) || string.IsNullOrWhiteSpace(request.CurrentSlot) || string.IsNullOrWhiteSpace(request.ProposedSlot) || string.IsNullOrWhiteSpace(request.Reason))
    {
        return Results.BadRequest(new { message = "Course, current slot, proposed slot, and reason are required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var entry = new FacultyTimetableChangeRequest
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        TeacherId = teacherId,
        CourseCode = request.CourseCode.Trim(),
        CurrentSlot = request.CurrentSlot.Trim(),
        ProposedSlot = request.ProposedSlot.Trim(),
        Reason = request.Reason.Trim(),
        Status = string.IsNullOrWhiteSpace(request.Status) ? "Pending" : request.Status.Trim(),
        ReviewNote = request.ReviewNote?.Trim() ?? string.Empty,
        RequestedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.TimetableChangeRequests.Add(entry);
    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.timetable-change-request.created", entry.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"{entry.CourseCode}:{entry.Status}"));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/teachers/{teacherId}/timetable-change-requests/{entry.Id}", entry);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/timetable-change-requests/{requestId:guid}/status", async (Guid teacherId, Guid requestId, HttpContext httpContext, [FromBody] UpdateTimetableChangeStatusRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    if (string.IsNullOrWhiteSpace(request.Status))
    {
        return Results.BadRequest(new { message = "Status is required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.TimetableChangeRequests.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.TeacherId == teacherId && x.Id == requestId);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status.Trim();
    item.ReviewNote = request.ReviewNote?.Trim() ?? item.ReviewNote;
    item.ReviewedAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.timetable-change-request.updated", item.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", item.Status));
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/teachers/{teacherId:guid}/mentoring-roster", async (Guid teacherId, HttpContext httpContext, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.MentoringAssignments
        .Where(x => x.TenantId == tenantId && x.TeacherId == teacherId)
        .OrderByDescending(x => x.NextMeetingAtUtc)
        .ToListAsync();
    return Results.Ok(new { items, total = items.Count });
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapPost("/api/v1/teachers/{teacherId:guid}/mentoring-roster/{assignmentId:guid}/status", async (Guid teacherId, Guid assignmentId, HttpContext httpContext, [FromBody] UpdateMentoringAssignmentStatusRequest request, AcademicDbContext dbContext) =>
{
    if (!CanAccessSubject(httpContext, teacherId, "Professor", "Principal", "Admin", "DepartmentHead"))
    {
        return Results.Forbid();
    }

    if (string.IsNullOrWhiteSpace(request.Status))
    {
        return Results.BadRequest(new { message = "Status is required." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.MentoringAssignments.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.TeacherId == teacherId && x.Id == assignmentId);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status.Trim();
    item.SupportArea = request.SupportArea?.Trim() ?? item.SupportArea;
    item.NextMeetingAtUtc = request.NextMeetingAtUtc ?? item.NextMeetingAtUtc;
    item.LastContactAtUtc = DateTimeOffset.UtcNow;

    dbContext.AuditLogs.Add(AcademicAuditLog.Create(tenantId, "academic.mentoring-assignment.updated", item.Id.ToString(), httpContext.User.Identity?.Name ?? "academic-service", $"{item.StudentName}:{item.Status}"));
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, AcademicDbContext dbContext, int page = 1, int pageSize = 20) =>
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

static async Task SeedAcademicDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AcademicDbContext>();

    if (!await dbContext.Courses.AnyAsync())
    {
        dbContext.Courses.AddRange(
        [
            new Course
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CourseCode = "CSE401",
                Title = "Distributed Systems",
                Credits = 4,
                SemesterCode = "2026-SPRING",
                FacultyId = KnownUsers.ProfessorId,
                DayOfWeek = "Monday",
                StartTime = "02:00 PM",
                Room = "B-204"
            },
            new Course
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CourseCode = "PHY201",
                Title = "Physics",
                Credits = 3,
                SemesterCode = "2026-SPRING",
                FacultyId = KnownUsers.ProfessorId,
                DayOfWeek = "Tuesday",
                StartTime = "10:00 AM",
                Room = "Lab-2"
            },
            new Course
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                CourseCode = "MTH301",
                Title = "Advanced Mathematics",
                Credits = 3,
                SemesterCode = "2026-SPRING",
                FacultyId = KnownUsers.ProfessorId,
                DayOfWeek = "Wednesday",
                StartTime = "11:30 AM",
                Room = "A-112"
            }
        ]);
    }

    if (!await dbContext.AdvisingNotes.AnyAsync())
    {
        dbContext.AdvisingNotes.AddRange(
        [
            new AdvisingNote
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                StudentName = "Aarav Sharma",
                CourseCode = "PHY201",
                Title = "Attendance recovery plan",
                Note = "Student should attend the next two lab sessions and submit the missed worksheet.",
                FollowUpStatus = "Open",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new AdvisingNote
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                StudentName = "Aarav Sharma",
                CourseCode = "CSE401",
                Title = "Exam readiness counseling",
                Note = "Asked student to focus on replication strategies and consistency trade-offs before the review.",
                FollowUpStatus = "Closed",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            }
        ]);
    }

    if (!await dbContext.OfficeHours.AnyAsync())
    {
        dbContext.OfficeHours.AddRange(
        [
            new FacultyOfficeHour
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "CSE401",
                DayOfWeek = "Tuesday",
                StartTime = "03:30 PM",
                EndTime = "04:30 PM",
                Location = "B-204",
                DeliveryMode = "In Person",
                Status = "Scheduled",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-6)
            },
            new FacultyOfficeHour
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "PHY201",
                DayOfWeek = "Thursday",
                StartTime = "11:00 AM",
                EndTime = "12:00 PM",
                Location = "Faculty Room 3",
                DeliveryMode = "Online",
                Status = "Scheduled",
                CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-4)
            }
        ]);
    }

    if (!await dbContext.SubstitutionRequests.AnyAsync())
    {
        dbContext.SubstitutionRequests.AddRange(
        [
            new FacultySubstitutionRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "MTH301",
                ClassDateUtc = DateTimeOffset.UtcNow.AddDays(2),
                Reason = "Conference presentation at the university research colloquium.",
                RequestedCoverTeacher = "Dr. Neha Kapoor",
                Status = "Pending",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            },
            new FacultySubstitutionRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "PHY201",
                ClassDateUtc = DateTimeOffset.UtcNow.AddDays(-3),
                Reason = "Medical appointment overlap.",
                RequestedCoverTeacher = "Dr. Raj Malhotra",
                Status = "Approved",
                AdminNote = "Class cover confirmed with the department office.",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-5),
                ReviewedAtUtc = DateTimeOffset.UtcNow.AddDays(-4)
            }
        ]);
    }

    if (!await dbContext.CoursePlans.AnyAsync())
    {
        dbContext.CoursePlans.AddRange(
        [
            new FacultyCoursePlan
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "CSE401",
                Title = "Unit 3 distributed storage plan",
                Coverage = "Replication patterns, leader election, and operational trade-offs.",
                Status = "Submitted",
                ReviewNote = "Waiting for department review.",
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2),
                SubmittedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new FacultyCoursePlan
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "PHY201",
                Title = "Lab cycle moderation plan",
                Coverage = "Attendance recovery support, practical demonstration flow, and quiz alignment.",
                Status = "Approved",
                ReviewNote = "Approved for this cycle.",
                UpdatedAtUtc = DateTimeOffset.UtcNow.AddDays(-3),
                SubmittedAtUtc = DateTimeOffset.UtcNow.AddDays(-4),
                ApprovedAtUtc = DateTimeOffset.UtcNow.AddDays(-3)
            }
        ]);
    }

    if (!await dbContext.TimetableChangeRequests.AnyAsync())
    {
        dbContext.TimetableChangeRequests.AddRange(
        [
            new FacultyTimetableChangeRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "CSE401",
                CurrentSlot = "Monday 02:00 PM | B-204",
                ProposedSlot = "Friday 09:00 AM | B-204",
                Reason = "Department review meeting overlaps with the current slot.",
                Status = "Pending",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            },
            new FacultyTimetableChangeRequest
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                CourseCode = "PHY201",
                CurrentSlot = "Tuesday 10:00 AM | Lab-2",
                ProposedSlot = "Wednesday 12:30 PM | Lab-2",
                Reason = "Lab maintenance window for the current slot.",
                Status = "Approved",
                ReviewNote = "Shift approved after lab coordination.",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-4),
                ReviewedAtUtc = DateTimeOffset.UtcNow.AddDays(-3)
            }
        ]);
    }

    if (!await dbContext.MentoringAssignments.AnyAsync())
    {
        dbContext.MentoringAssignments.AddRange(
        [
            new FacultyMentoringAssignment
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                StudentName = "Aarav Sharma",
                Batch = "2022",
                SupportArea = "Attendance recovery",
                RiskLevel = "High",
                Status = "Meeting Scheduled",
                NextMeetingAtUtc = DateTimeOffset.UtcNow.AddDays(1),
                LastContactAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new FacultyMentoringAssignment
            {
                Id = Guid.NewGuid(),
                TenantId = "default",
                TeacherId = KnownUsers.ProfessorId,
                StudentName = "Riya Menon",
                Batch = "2023",
                SupportArea = "Exam confidence and planning",
                RiskLevel = "Medium",
                Status = "Support Plan Active",
                NextMeetingAtUtc = DateTimeOffset.UtcNow.AddDays(3),
                LastContactAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
            }
        ]);
    }

    await dbContext.SaveChangesAsync();
}

static bool CanAccessSubject(HttpContext httpContext, Guid requestedUserId, params string[] elevatedRoles)
{
    var role = httpContext.User.FindFirst("role")?.Value
        ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
        ?? string.Empty;

    if (elevatedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
    {
        return true;
    }

    var currentUserId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? httpContext.User.FindFirst("sub")?.Value;

    return Guid.TryParse(currentUserId, out var parsedUserId) && parsedUserId == requestedUserId;
}

public sealed record CreateCourseRequest(
    string TenantId,
    string CourseCode,
    string Title,
    int Credits,
    string SemesterCode,
    Guid FacultyId,
    string DayOfWeek,
    string StartTime,
    string Room);

public sealed record CreateAdvisingNoteRequest(string TenantId, string StudentName, string? CourseCode, string Title, string Note, string? FollowUpStatus);
public sealed record CreateOfficeHourRequest(string TenantId, string CourseCode, string DayOfWeek, string StartTime, string EndTime, string Location, string? DeliveryMode, string? Status);
public sealed record CreateSubstitutionRequest(string TenantId, string CourseCode, DateTimeOffset ClassDateUtc, string Reason, string? RequestedCoverTeacher, string? Status, string? AdminNote);
public sealed record UpdateSubstitutionRequestStatusRequest(string Status, string? AdminNote, string? RequestedCoverTeacher);
public sealed record CreateCoursePlanRequest(string TenantId, string CourseCode, string Title, string Coverage, string? Status, string? ReviewNote);
public sealed record UpdateCoursePlanStatusRequest(string Status, string? ReviewNote);
public sealed record CreateTimetableChangeRequest(string TenantId, string CourseCode, string CurrentSlot, string ProposedSlot, string Reason, string? Status, string? ReviewNote);
public sealed record UpdateTimetableChangeStatusRequest(string Status, string? ReviewNote);
public sealed record UpdateMentoringAssignmentStatusRequest(string Status, string? SupportArea, DateTimeOffset? NextMeetingAtUtc);

public sealed class Course
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string CourseCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int Credits { get; set; }
    public string SemesterCode { get; set; } = string.Empty;
    public Guid FacultyId { get; set; }
    public string DayOfWeek { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string Room { get; set; } = string.Empty;
}

public sealed class AcademicAuditLog
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Action { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    public static AcademicAuditLog Create(string tenantId, string action, string entityId, string actor, string details) =>
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

public sealed class AdvisingNote
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string FollowUpStatus { get; set; } = "Open";
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class FacultyOfficeHour
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public string DayOfWeek { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string DeliveryMode { get; set; } = "In Person";
    public string Status { get; set; } = "Scheduled";
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class FacultySubstitutionRequest
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public DateTimeOffset ClassDateUtc { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string RequestedCoverTeacher { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string AdminNote { get; set; } = string.Empty;
    public DateTimeOffset RequestedAtUtc { get; set; }
    public DateTimeOffset? ReviewedAtUtc { get; set; }
}

public sealed class FacultyCoursePlan
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Coverage { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft";
    public string ReviewNote { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset? SubmittedAtUtc { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }
}

public sealed class FacultyTimetableChangeRequest
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public string CurrentSlot { get; set; } = string.Empty;
    public string ProposedSlot { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string ReviewNote { get; set; } = string.Empty;
    public DateTimeOffset RequestedAtUtc { get; set; }
    public DateTimeOffset? ReviewedAtUtc { get; set; }
}

public sealed class FacultyMentoringAssignment
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid TeacherId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string Batch { get; set; } = string.Empty;
    public string SupportArea { get; set; } = string.Empty;
    public string RiskLevel { get; set; } = "Medium";
    public string Status { get; set; } = "Meeting Scheduled";
    public DateTimeOffset NextMeetingAtUtc { get; set; }
    public DateTimeOffset? LastContactAtUtc { get; set; }
}

public sealed class AcademicDbContext(DbContextOptions<AcademicDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<AdvisingNote> AdvisingNotes => Set<AdvisingNote>();
    public DbSet<FacultyOfficeHour> OfficeHours => Set<FacultyOfficeHour>();
    public DbSet<FacultySubstitutionRequest> SubstitutionRequests => Set<FacultySubstitutionRequest>();
    public DbSet<FacultyCoursePlan> CoursePlans => Set<FacultyCoursePlan>();
    public DbSet<FacultyTimetableChangeRequest> TimetableChangeRequests => Set<FacultyTimetableChangeRequest>();
    public DbSet<FacultyMentoringAssignment> MentoringAssignments => Set<FacultyMentoringAssignment>();
    public DbSet<AcademicAuditLog> AuditLogs => Set<AcademicAuditLog>();
}

public sealed record FacultyAdministrationSummary(
    int OfficeHoursScheduled,
    int PendingClassCoverRequests,
    int CoursePlansAwaitingApproval,
    int ApprovedCoursePlans,
    int AdviseeFollowUpsOpen,
    int PendingTimetableChanges,
    int MentoringStudents,
    int MentoringAlerts)
{
    public static FacultyAdministrationSummary Create(
        IReadOnlyCollection<FacultyOfficeHour> officeHours,
        IReadOnlyCollection<FacultySubstitutionRequest> substitutionRequests,
        IReadOnlyCollection<FacultyCoursePlan> coursePlans,
        IReadOnlyCollection<AdvisingNote> advisingNotes,
        IReadOnlyCollection<FacultyTimetableChangeRequest> timetableChanges,
        IReadOnlyCollection<FacultyMentoringAssignment> mentoringAssignments) =>
        new(
            officeHours.Count(item => !string.Equals(item.Status, "Cancelled", StringComparison.OrdinalIgnoreCase)),
            substitutionRequests.Count(item => string.Equals(item.Status, "Pending", StringComparison.OrdinalIgnoreCase)),
            coursePlans.Count(item => string.Equals(item.Status, "Submitted", StringComparison.OrdinalIgnoreCase) || string.Equals(item.Status, "Review", StringComparison.OrdinalIgnoreCase)),
            coursePlans.Count(item => string.Equals(item.Status, "Approved", StringComparison.OrdinalIgnoreCase)),
            advisingNotes.Count(item => string.Equals(item.FollowUpStatus, "Open", StringComparison.OrdinalIgnoreCase)),
            timetableChanges.Count(item => string.Equals(item.Status, "Pending", StringComparison.OrdinalIgnoreCase)),
            mentoringAssignments.Count,
            mentoringAssignments.Count(item => string.Equals(item.RiskLevel, "High", StringComparison.OrdinalIgnoreCase) || string.Equals(item.Status, "Needs Attention", StringComparison.OrdinalIgnoreCase)));
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
    public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999");
}
