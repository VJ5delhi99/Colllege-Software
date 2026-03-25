using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<AttendanceDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await SeedAttendanceDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "attendance-service", mode = "qr-and-ai-ready" }));

app.MapPost("/api/v1/sessions", async (CreateSessionRequest request, AttendanceDbContext dbContext) =>
{
    var session = new AttendanceSession
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        CourseCode = request.CourseCode,
        ProfessorId = request.ProfessorId,
        QrCode = $"QR-{Guid.NewGuid():N}"[..12],
        Status = "Active",
        StartedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.Sessions.Add(session);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/sessions/{session.Id}", session);
}).RequireRoles("Professor", "Admin");

app.MapPost("/api/v1/sessions/{sessionId:guid}/close", async (Guid sessionId, AttendanceDbContext dbContext) =>
{
    var session = await dbContext.Sessions.FirstOrDefaultAsync(x => x.Id == sessionId);
    if (session is null) return Results.NotFound();
    session.Status = "Closed";
    session.ClosedAtUtc = DateTimeOffset.UtcNow;
    await dbContext.SaveChangesAsync();
    return Results.Ok(session);
}).RequireRoles("Professor", "Admin");

app.MapPost("/api/v1/sessions/{sessionId:guid}/records", async (Guid sessionId, [FromBody] RecordAttendanceRequest request, AttendanceDbContext dbContext) =>
{
    var record = new AttendanceRecord
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        SessionId = sessionId,
        StudentId = request.StudentId,
        CourseCode = request.CourseCode,
        Method = request.Method,
        Status = request.Status,
        CapturedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.AttendanceRecords.Add(record);
    await dbContext.SaveChangesAsync();
    return Results.Accepted($"/api/v1/sessions/{sessionId}/records/{record.Id}", record);
}).RequireRateLimiting("api");

app.MapPost("/api/v1/face-recognition/verify", (FaceRecognitionRequest request) =>
{
    return Results.Ok(new
    {
        matched = request.StudentId == KnownUsers.StudentId,
        confidence = request.StudentId == KnownUsers.StudentId ? 0.97 : 0.22
    });
}).RequireRoles("Professor", "Admin");

app.MapGet("/api/v1/analytics/summary", async (HttpContext httpContext, AttendanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetTenantId();
    var total = await dbContext.AttendanceRecords.CountAsync(x => x.TenantId == tenantId);
    var present = await dbContext.AttendanceRecords.CountAsync(x => x.TenantId == tenantId && x.Status == "Present");
    return Results.Ok(new
    {
        total,
        present,
        percentage = total == 0 ? 0 : Math.Round((double)present / total * 100, 2)
    });
});

app.MapGet("/api/v1/students/{studentId:guid}/summary", async (Guid studentId, HttpContext httpContext, AttendanceDbContext dbContext) =>
{
    var records = await dbContext.AttendanceRecords.Where(x => x.TenantId == httpContext.GetTenantId() && x.StudentId == studentId).ToListAsync();
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
});

app.Run();

static async Task SeedAttendanceDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AttendanceDbContext>();
    await dbContext.Database.EnsureCreatedAsync();

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

public sealed record CreateSessionRequest(string TenantId, string CourseCode, Guid ProfessorId);
public sealed record RecordAttendanceRequest(string TenantId, Guid StudentId, string CourseCode, string Method, string Status);
public sealed record FaceRecognitionRequest(Guid StudentId, string ImageReference);

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

public sealed class AttendanceDbContext(DbContextOptions<AttendanceDbContext> options) : DbContext(options)
{
    public DbSet<AttendanceSession> Sessions => Set<AttendanceSession>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}
