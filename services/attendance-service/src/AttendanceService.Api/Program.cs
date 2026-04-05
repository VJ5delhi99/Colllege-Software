using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<AttendanceDbContext>();
builder.Services.AddHttpClient<FaceRecognitionClient>(client =>
    client.BaseAddress = new Uri(builder.Configuration["DownstreamServices:FaceRecognition"] ?? "http://face-recognition-service:8000"));

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<AttendanceDbContext>();
await SeedAttendanceDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "attendance-service", mode = "qr-and-ai-ready" }));

app.MapPost("/api/v1/sessions", async (HttpContext httpContext, CreateSessionRequest request, AttendanceDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var session = new AttendanceSession
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        CourseCode = request.CourseCode,
        ProfessorId = request.ProfessorId,
        QrCode = $"QR-{Guid.NewGuid():N}"[..12],
        Status = "Active",
        StartedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.Sessions.Add(session);
    dbContext.AuditLogs.Add(AttendanceAuditLog.Create(tenantId, "attendance.session.created", session.Id.ToString(), httpContext.User.Identity?.Name ?? "attendance-service", $"Attendance session created for course {session.CourseCode}."));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/sessions/{session.Id}", session);
}).RequirePermissions("attendance.mark");

app.MapPost("/api/v1/sessions/{sessionId:guid}/close", async (Guid sessionId, HttpContext httpContext, AttendanceDbContext dbContext) =>
{
    var session = await dbContext.Sessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.TenantId == httpContext.GetValidatedTenantId());
    if (session is null)
    {
        return Results.NotFound();
    }

    session.Status = "Closed";
    session.ClosedAtUtc = DateTimeOffset.UtcNow;
    dbContext.AuditLogs.Add(AttendanceAuditLog.Create(session.TenantId, "attendance.session.closed", session.Id.ToString(), httpContext.User.Identity?.Name ?? "attendance-service", $"Attendance session for course {session.CourseCode} was closed."));
    await dbContext.SaveChangesAsync();
    return Results.Ok(session);
}).RequirePermissions("attendance.mark");

app.MapPost("/api/v1/sessions/{sessionId:guid}/records", async (Guid sessionId, HttpContext httpContext, [FromBody] RecordAttendanceRequest request, AttendanceDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var session = await dbContext.Sessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.TenantId == tenantId && x.Status == "Active");
    if (session is null)
    {
        return Results.BadRequest(new { message = "Attendance session is invalid or closed." });
    }

    var existing = await dbContext.AttendanceRecords.AnyAsync(x => x.TenantId == tenantId && x.SessionId == sessionId && x.StudentId == request.StudentId);
    if (existing)
    {
        return Results.Conflict(new { message = "Attendance has already been captured for this student." });
    }

    var record = new AttendanceRecord
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        SessionId = sessionId,
        StudentId = request.StudentId,
        CourseCode = request.CourseCode,
        Method = request.Method,
        Status = request.Status,
        CapturedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.AttendanceRecords.Add(record);
    dbContext.AuditLogs.Add(AttendanceAuditLog.Create(tenantId, "attendance.recorded", record.Id.ToString(), httpContext.User.Identity?.Name ?? "attendance-service", $"Attendance recorded for student {record.StudentId} in course {record.CourseCode} via {record.Method}."));
    await dbContext.SaveChangesAsync();
    return Results.Accepted($"/api/v1/sessions/{sessionId}/records/{record.Id}", record);
}).RequirePermissions("attendance.mark");

app.MapPost("/api/v1/face-recognition/upload-request", async (HttpContext httpContext, [FromBody] FaceUploadRequest request, IObjectStorageService storage) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var objectKey = $"{httpContext.GetValidatedTenantId()}/attendance/{request.StudentId}/{Guid.NewGuid():N}.jpg";
    var signedUrl = await storage.CreateUploadUrlAsync("university360-attendance", objectKey, "image/jpeg", TimeSpan.FromMinutes(10));
    return Results.Ok(new { objectKey, upload = signedUrl });
}).RequirePermissions("attendance.mark");

app.MapPost("/api/v1/face-recognition/verify", async ([FromBody] FaceRecognitionRequest request, FaceRecognitionClient client) =>
{
    var result = await client.VerifyAsync(request);
    return Results.Ok(result);
}).RequirePermissions("attendance.mark");

app.MapPost("/api/v1/face-recognition/match-and-record", async (HttpContext httpContext, [FromBody] FaceAttendanceRequest request, FaceRecognitionClient client, AttendanceDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var verification = await client.VerifyAsync(new FaceRecognitionRequest(request.StudentId, request.ImageReference));
    if (!verification.Matched)
    {
        return Results.BadRequest(verification);
    }

    var session = await dbContext.Sessions.FirstOrDefaultAsync(x => x.Id == request.SessionId && x.TenantId == tenantId && x.Status == "Active");
    if (session is null)
    {
        return Results.BadRequest(new { message = "Attendance session is invalid or closed." });
    }

    var existing = await dbContext.AttendanceRecords.AnyAsync(x => x.TenantId == tenantId && x.SessionId == request.SessionId && x.StudentId == request.StudentId);
    if (existing)
    {
        return Results.Conflict(new { message = "Attendance has already been captured for this student." });
    }

    var record = new AttendanceRecord
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        SessionId = request.SessionId,
        StudentId = request.StudentId,
        CourseCode = request.CourseCode,
        Method = "Face",
        Status = "Present",
        CapturedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.AttendanceRecords.Add(record);
    dbContext.AuditLogs.Add(AttendanceAuditLog.Create(tenantId, "attendance.face-recorded", record.Id.ToString(), httpContext.User.Identity?.Name ?? "attendance-service", $"Face-recognition attendance recorded for student {record.StudentId} in course {record.CourseCode}."));
    await dbContext.SaveChangesAsync();
    return Results.Accepted($"/api/v1/sessions/{request.SessionId}/records/{record.Id}", new { verification, record });
}).RequirePermissions("attendance.mark");

app.MapGet("/api/v1/analytics/summary", async (HttpContext httpContext, AttendanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var total = await dbContext.AttendanceRecords.CountAsync(x => x.TenantId == tenantId);
    var present = await dbContext.AttendanceRecords.CountAsync(x => x.TenantId == tenantId && x.Status == "Present");
    return Results.Ok(new
    {
        total,
        present,
        percentage = total == 0 ? 0 : Math.Round((double)present / total * 100, 2)
    });
}).RequirePermissions("attendance.view");

app.MapGet("/api/v1/teachers/{teacherId:guid}/summary", async (Guid teacherId, HttpContext httpContext, AttendanceDbContext dbContext) =>
{
    if (!TeacherAttendanceAccessPolicy.CanAccessTeacherAttendance(httpContext, teacherId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var sessions = await dbContext.Sessions
        .Where(x => x.TenantId == tenantId && x.ProfessorId == teacherId)
        .OrderByDescending(x => x.StartedAtUtc)
        .ToListAsync();
    var sessionIds = sessions.Select(x => x.Id).ToArray();
    var records = sessionIds.Length == 0
        ? []
        : await dbContext.AttendanceRecords
            .Where(x => x.TenantId == tenantId && sessionIds.Contains(x.SessionId))
            .OrderByDescending(x => x.CapturedAtUtc)
            .ToListAsync();

    return Results.Ok(TeacherAttendanceSummary.Create(sessions, records));
}).RequireRoles("Professor", "Principal", "Admin", "DepartmentHead");

app.MapGet("/api/v1/students/{studentId:guid}/summary", async (Guid studentId, HttpContext httpContext, AttendanceDbContext dbContext) =>
{
    var records = await dbContext.AttendanceRecords.Where(x => x.TenantId == httpContext.GetValidatedTenantId() && x.StudentId == studentId).ToListAsync();
    var total = records.Count;
    var present = records.Count(x => x.Status == "Present");
    var physics = records.Where(x => x.CourseCode == "PHY201").ToList();
    var physicsPresent = physics.Count(x => x.Status == "Present");

    return Results.Ok(new
    {
        total,
        present,
        percentage = total == 0 ? 0 : Math.Round((double)present / total * 100, 2),
        physicsPercentage = physics.Count == 0 ? 0 : Math.Round((double)physicsPresent / physics.Count * 100, 2)
    });
}).RequirePermissions("attendance.view");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, AttendanceDbContext dbContext, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.AuditLogs.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.CreatedAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequirePermissions("attendance.view");

app.Run();

static async Task SeedAttendanceDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AttendanceDbContext>();

    if (await dbContext.AttendanceRecords.AnyAsync())
    {
        return;
    }

    var sessionIds = Enumerable.Range(0, 6).Select(_ => Guid.NewGuid()).ToArray();
    dbContext.AttendanceRecords.AddRange(
    [
        new AttendanceRecord { Id = Guid.NewGuid(), TenantId = "default", SessionId = sessionIds[0], StudentId = KnownUsers.StudentId, CourseCode = "PHY201", Method = "QR", Status = "Present", CapturedAtUtc = DateTimeOffset.UtcNow.AddDays(-10) },
        new AttendanceRecord { Id = Guid.NewGuid(), TenantId = "default", SessionId = sessionIds[1], StudentId = KnownUsers.StudentId, CourseCode = "PHY201", Method = "QR", Status = "Present", CapturedAtUtc = DateTimeOffset.UtcNow.AddDays(-8) },
        new AttendanceRecord { Id = Guid.NewGuid(), TenantId = "default", SessionId = sessionIds[2], StudentId = KnownUsers.StudentId, CourseCode = "PHY201", Method = "Face", Status = "Absent", CapturedAtUtc = DateTimeOffset.UtcNow.AddDays(-6) },
        new AttendanceRecord { Id = Guid.NewGuid(), TenantId = "default", SessionId = sessionIds[3], StudentId = KnownUsers.StudentId, CourseCode = "CSE401", Method = "QR", Status = "Present", CapturedAtUtc = DateTimeOffset.UtcNow.AddDays(-5) },
        new AttendanceRecord { Id = Guid.NewGuid(), TenantId = "default", SessionId = sessionIds[4], StudentId = KnownUsers.StudentId, CourseCode = "CSE401", Method = "QR", Status = "Present", CapturedAtUtc = DateTimeOffset.UtcNow.AddDays(-3) },
        new AttendanceRecord { Id = Guid.NewGuid(), TenantId = "default", SessionId = sessionIds[5], StudentId = KnownUsers.StudentId, CourseCode = "MTH301", Method = "QR", Status = "Present", CapturedAtUtc = DateTimeOffset.UtcNow.AddDays(-1) }
    ]);
    dbContext.Sessions.Add(new AttendanceSession { Id = sessionIds[0], TenantId = "default", CourseCode = "PHY201", ProfessorId = KnownUsers.ProfessorId, QrCode = "QR-PHY201-1", Status = "Closed", StartedAtUtc = DateTimeOffset.UtcNow.AddDays(-10), ClosedAtUtc = DateTimeOffset.UtcNow.AddDays(-10).AddHours(1) });

    await dbContext.SaveChangesAsync();
}

public sealed class FaceRecognitionClient(HttpClient httpClient)
{
    public async Task<FaceRecognitionResult> VerifyAsync(FaceRecognitionRequest request)
    {
        var response = await httpClient.PostAsJsonAsync("/verify", request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<FaceRecognitionResult>() ?? new FaceRecognitionResult(false, 0);
    }
}

public sealed record CreateSessionRequest(string TenantId, string CourseCode, Guid ProfessorId);
public sealed record RecordAttendanceRequest(string TenantId, Guid StudentId, string CourseCode, string Method, string Status);
public sealed record FaceRecognitionRequest(Guid StudentId, string ImageReference);
public sealed record FaceUploadRequest(string TenantId, Guid StudentId);
public sealed record FaceAttendanceRequest(string TenantId, Guid SessionId, Guid StudentId, string CourseCode, string ImageReference);
public sealed record FaceRecognitionResult(bool Matched, double Confidence);

public sealed class AttendanceSession
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string CourseCode { get; set; } = string.Empty;
    public Guid ProfessorId { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? ClosedAtUtc { get; set; }
}

public sealed class AttendanceRecord
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid SessionId { get; set; }
    public Guid StudentId { get; set; }
    public string CourseCode { get; set; } = string.Empty;
    public string Method { get; set; } = "QR";
    public string Status { get; set; } = "Present";
    public DateTimeOffset CapturedAtUtc { get; set; }
}

public sealed class AttendanceAuditLog
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Action { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    public static AttendanceAuditLog Create(string tenantId, string action, string entityId, string actor, string details) =>
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

public sealed class AttendanceDbContext(DbContextOptions<AttendanceDbContext> options) : DbContext(options)
{
    public DbSet<AttendanceSession> Sessions => Set<AttendanceSession>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<AttendanceAuditLog> AuditLogs => Set<AttendanceAuditLog>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
}

public sealed record TeacherAttendanceSummary(
    int TotalSessions,
    int ActiveSessions,
    int RecordsCaptured,
    double AttendancePercentage,
    int LowAttendanceCourses,
    TeacherAttendanceAlert[] Alerts)
{
    public static TeacherAttendanceSummary Create(
        IReadOnlyCollection<AttendanceSession> sessions,
        IReadOnlyCollection<AttendanceRecord> records)
    {
        var groupedAlerts = records
            .GroupBy(item => item.CourseCode)
            .Select(group =>
            {
                var total = group.Count();
                var present = group.Count(item => item.Status == "Present");
                var percentage = total == 0 ? 0 : Math.Round((double)present / total * 100, 2);
                return new TeacherAttendanceAlert(group.Key, percentage, total);
            })
            .OrderBy(item => item.Percentage)
            .ThenByDescending(item => item.TotalRecords)
            .ToArray();

        var totalRecords = records.Count;
        var presentRecords = records.Count(item => item.Status == "Present");
        return new TeacherAttendanceSummary(
            sessions.Count,
            sessions.Count(item => item.Status == "Active"),
            totalRecords,
            totalRecords == 0 ? 0 : Math.Round((double)presentRecords / totalRecords * 100, 2),
            groupedAlerts.Count(item => item.TotalRecords > 0 && item.Percentage < 75),
            groupedAlerts.Take(4).ToArray());
    }
}

public sealed record TeacherAttendanceAlert(string CourseCode, double Percentage, int TotalRecords);

public static class TeacherAttendanceAccessPolicy
{
    public static bool CanAccessTeacherAttendance(HttpContext httpContext, Guid requestedUserId)
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
