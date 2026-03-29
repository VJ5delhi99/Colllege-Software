namespace IdentityService.Api.Domain;

public sealed class PlatformUser
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool PasswordlessEnabled { get; set; }
    public bool MfaEnabled { get; set; }
    public bool EmailVerified { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string? TotpSecret { get; set; }
}

public sealed class AuthSession
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public string RefreshToken { get; set; } = string.Empty;
    public DateTimeOffset RefreshTokenExpiresAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class AuthorizationCodeGrant
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

public sealed class PasswordlessChallenge
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Channel { get; set; } = "email";
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

public sealed class MfaChallenge
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string OtpCode { get; set; } = string.Empty;
    public string Channel { get; set; } = "email";
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

public sealed class PasswordResetChallenge
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

public sealed class EmailVerificationChallenge
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

public sealed class DeliveryLog
{
    public Guid Id { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string MessagePreview { get; set; } = string.Empty;
    public string Status { get; set; } = "Queued";
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class FederatedAuthProvider
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string AuthorizationEndpoint { get; set; } = string.Empty;
    public string TokenEndpoint { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public bool Enabled { get; set; }
}

public sealed class IdentityAuditLog
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    public static IdentityAuditLog Create(string tenantId, string action, string entityId, string actor, string details) =>
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

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
    public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999");
    public static readonly Guid FinanceStaffId = Guid.Parse("00000000-0000-0000-0000-000000000888");
}
