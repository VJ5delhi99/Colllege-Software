namespace University360.BuildingBlocks.Contracts;

public abstract record IntegrationEvent(Guid EventId, DateTimeOffset OccurredAtUtc, string TenantId);

public sealed record StudentRegistered(Guid StudentId, string UniversityEmail, string DepartmentCode, string TenantId)
    : IntegrationEvent(Guid.NewGuid(), DateTimeOffset.UtcNow, TenantId);

public sealed record CourseAssigned(Guid CourseId, Guid FacultyId, string SemesterCode, string TenantId)
    : IntegrationEvent(Guid.NewGuid(), DateTimeOffset.UtcNow, TenantId);

public sealed record AttendanceRecorded(Guid AttendanceId, Guid SessionId, Guid StudentId, string Status, string TenantId)
    : IntegrationEvent(Guid.NewGuid(), DateTimeOffset.UtcNow, TenantId);

public sealed record AnnouncementCreated(Guid AnnouncementId, string Audience, string Title, string TenantId)
    : IntegrationEvent(Guid.NewGuid(), DateTimeOffset.UtcNow, TenantId);

public sealed record ResultPublished(Guid ResultId, Guid StudentId, string SemesterCode, string TenantId)
    : IntegrationEvent(Guid.NewGuid(), DateTimeOffset.UtcNow, TenantId);

public sealed record FeePaid(Guid PaymentId, Guid StudentId, decimal Amount, string Currency, string TenantId)
    : IntegrationEvent(Guid.NewGuid(), DateTimeOffset.UtcNow, TenantId);
