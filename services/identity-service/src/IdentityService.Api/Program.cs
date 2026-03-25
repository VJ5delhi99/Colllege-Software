using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<IdentityDbContext>();
builder.Services.AddHttpClient<AuthorizationCatalogClient>(client =>
    client.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Authorization"] ?? "http://authorization-service:8080"));

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<IdentityDbContext>();
await SeedIdentityDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "identity-service", status = "ready", flows = new[] { "jwt", "refresh-token", "passwordless", "mfa" } }));

app.MapPost("/api/v1/users", async ([FromBody] RegisterUserRequest request, IdentityDbContext dbContext) =>
{
    var user = new PlatformUser
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Email = request.Email,
        FullName = request.FullName,
        Role = request.Role,
        PasswordlessEnabled = request.PasswordlessEnabled,
        MfaEnabled = request.MfaEnabled,
        PasswordHash = request.Password ?? "dev-password"
    };

    dbContext.Users.Add(user);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/users/{user.Id}", user);
}).RequirePermissions("rbac.manage");

app.MapGet("/api/v1/users", async (HttpContext httpContext, IdentityDbContext dbContext) =>
    await dbContext.Users.Where(x => x.TenantId == httpContext.GetTenantId()).OrderBy(x => x.FullName).ToListAsync())
    .RequirePermissions("rbac.manage");

app.MapGet("/api/v1/users/{id:guid}", async (Guid id, HttpContext httpContext, IdentityDbContext dbContext) =>
{
    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.TenantId == httpContext.GetTenantId() && x.Id == id);
    return user is null ? Results.NotFound() : Results.Ok(user);
}).RequirePermissions("rbac.manage");

app.MapPost("/api/v1/auth/passwordless/challenge", async ([FromBody] PasswordlessChallengeRequest request, IdentityDbContext dbContext) =>
{
    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == request.Email && x.TenantId == request.TenantId);
    if (user is null || !user.PasswordlessEnabled)
    {
        return Results.BadRequest(new { message = "Passwordless login is not enabled for this user." });
    }

    var challenge = new PasswordlessChallenge
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Email = request.Email,
        Code = GenerateOneTimeCode(),
        ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5)
    };

    dbContext.PasswordlessChallenges.Add(challenge);
    await dbContext.SaveChangesAsync();
    return Results.Ok(new { challengeId = challenge.Id, expiresAtUtc = challenge.ExpiresAtUtc, devCode = challenge.Code });
});

app.MapPost("/api/v1/auth/mfa/challenge", async ([FromBody] MfaChallengeRequest request, IdentityDbContext dbContext) =>
{
    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == request.Email && x.TenantId == request.TenantId);
    if (user is null || !user.MfaEnabled)
    {
        return Results.BadRequest(new { message = "MFA is not enabled for this user." });
    }

    var challenge = new MfaChallenge
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Email = request.Email,
        OtpCode = GenerateOneTimeCode(),
        ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5)
    };

    dbContext.MfaChallenges.Add(challenge);
    await dbContext.SaveChangesAsync();
    return Results.Ok(new { challengeId = challenge.Id, expiresAtUtc = challenge.ExpiresAtUtc, devCode = challenge.OtpCode });
});

app.MapPost("/api/v1/auth/token", async ([FromBody] TokenRequest request, IdentityDbContext dbContext, IConfiguration configuration, AuthorizationCatalogClient authorizationClient) =>
{
    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == request.Email && x.TenantId == request.TenantId);
    if (user is null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    if (user.PasswordlessEnabled && !string.IsNullOrWhiteSpace(request.PasswordlessCode))
    {
        var validChallenge = await dbContext.PasswordlessChallenges
            .OrderByDescending(x => x.ExpiresAtUtc)
            .FirstOrDefaultAsync(x => x.Email == request.Email && x.TenantId == request.TenantId && x.Code == request.PasswordlessCode && x.ExpiresAtUtc > DateTimeOffset.UtcNow);

        if (validChallenge is null)
        {
            return Results.BadRequest(new { message = "Invalid passwordless code" });
        }
    }
    else if (!string.Equals(user.PasswordHash, request.Password, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { message = "Invalid credentials" });
    }

    if (user.MfaEnabled)
    {
        var validMfa = await dbContext.MfaChallenges
            .OrderByDescending(x => x.ExpiresAtUtc)
            .FirstOrDefaultAsync(x => x.Email == request.Email && x.TenantId == request.TenantId && x.OtpCode == request.MfaCode && x.ExpiresAtUtc > DateTimeOffset.UtcNow);

        if (validMfa is null)
        {
            return Results.BadRequest(new { message = "MFA verification required" });
        }
    }

    var resolution = await authorizationClient.ResolvePermissionsAsync(user, request.TenantId);
    var session = new AuthSession
    {
        Id = Guid.NewGuid(),
        TenantId = user.TenantId,
        UserId = user.Id,
        RefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)),
        RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14),
        CreatedAtUtc = DateTimeOffset.UtcNow
    };
    dbContext.Sessions.Add(session);
    await dbContext.SaveChangesAsync();

    return Results.Ok(CreateTokenResponse(user, resolution, session, configuration));
});

app.MapPost("/api/v1/auth/refresh", async ([FromBody] RefreshTokenRequest request, IdentityDbContext dbContext, IConfiguration configuration, AuthorizationCatalogClient authorizationClient) =>
{
    var session = await dbContext.Sessions.FirstOrDefaultAsync(x => x.RefreshToken == request.RefreshToken && x.RefreshTokenExpiresAtUtc > DateTimeOffset.UtcNow);
    if (session is null)
    {
        return Results.BadRequest(new { message = "Refresh token is invalid or expired" });
    }

    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == session.UserId && x.TenantId == session.TenantId);
    if (user is null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var resolution = await authorizationClient.ResolvePermissionsAsync(user, session.TenantId);
    session.RefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    session.RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14);
    await dbContext.SaveChangesAsync();

    return Results.Ok(CreateTokenResponse(user, resolution, session, configuration));
});

app.MapPost("/api/v1/auth/logout", async ([FromBody] LogoutRequest request, IdentityDbContext dbContext) =>
{
    var session = await dbContext.Sessions.FirstOrDefaultAsync(x => x.RefreshToken == request.RefreshToken);
    if (session is null)
    {
        return Results.NoContent();
    }

    dbContext.Sessions.Remove(session);
    await dbContext.SaveChangesAsync();
    return Results.NoContent();
});

app.MapGet("/api/v1/roles", () => Results.Ok(new[]
{
    "Student", "Professor", "Principal", "DepartmentHead", "Admin", "FinanceStaff"
}));

app.Run();

static async Task SeedIdentityDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

    if (await dbContext.Users.AnyAsync())
    {
        return;
    }

    dbContext.Users.AddRange(
    [
        new PlatformUser { Id = KnownUsers.StudentId, TenantId = "default", Email = "student@university360.edu", FullName = "Aarav Sharma", Role = "Student", PasswordlessEnabled = true, MfaEnabled = false, PasswordHash = "student-pass" },
        new PlatformUser { Id = KnownUsers.ProfessorId, TenantId = "default", Email = "professor@university360.edu", FullName = "Dr. Meera Iyer", Role = "Professor", PasswordlessEnabled = true, MfaEnabled = true, PasswordHash = "professor-pass" },
        new PlatformUser { Id = KnownUsers.AdminId, TenantId = "default", Email = "principal@university360.edu", FullName = "Prof. Kavita Menon", Role = "Principal", PasswordlessEnabled = true, MfaEnabled = true, PasswordHash = "principal-pass" }
    ]);

    await dbContext.SaveChangesAsync();
}

static string GenerateOneTimeCode() => RandomNumberGenerator.GetInt32(100000, 999999).ToString();

static TokenResponse CreateTokenResponse(PlatformUser user, PermissionResolution resolution, AuthSession session, IConfiguration configuration)
{
    var key = configuration["Platform:Jwt:SigningKey"] ?? "development-signing-key-please-change";
    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new(ClaimTypes.Email, user.Email),
        new(ClaimTypes.Role, user.Role),
        new("role", user.Role),
        new("tenant_id", user.TenantId),
        new("session_id", session.Id.ToString())
    };

    claims.AddRange(resolution.Permissions.Select(permission => new Claim("permission", permission)));

    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
        issuer: configuration["Platform:Jwt:Authority"] ?? "https://identity.university360.local",
        audience: configuration["Platform:Jwt:Audience"] ?? "university360-api",
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(30),
        signingCredentials: credentials);

    return new TokenResponse(
        new JwtSecurityTokenHandler().WriteToken(token),
        session.RefreshToken,
        user.Id,
        user.FullName,
        user.Email,
        user.Role,
        user.TenantId,
        resolution.Permissions);
}

public sealed class AuthorizationCatalogClient(HttpClient httpClient)
{
    public async Task<PermissionResolution> ResolvePermissionsAsync(PlatformUser user, string tenantId)
    {
        try
        {
            var response = await httpClient.GetFromJsonAsync<PermissionResolution>($"/internal/users/{user.Id}/permissions?role={Uri.EscapeDataString(user.Role)}&tenantId={Uri.EscapeDataString(tenantId)}");
            return response ?? new PermissionResolution(tenantId, user.Id, [user.Role], []);
        }
        catch
        {
            return new PermissionResolution(tenantId, user.Id, [user.Role], FallbackPermissionsForRole(user.Role));
        }
    }

    private static string[] FallbackPermissionsForRole(string role) => role switch
    {
        "Student" => ["attendance.view", "results.view"],
        "Professor" => ["attendance.view", "attendance.mark", "announcements.create", "files.upload"],
        "Principal" => ["attendance.view", "results.view", "results.publish", "analytics.view", "announcements.create"],
        "Admin" => ["rbac.manage", "analytics.view", "finance.manage"],
        "FinanceStaff" => ["finance.manage", "payments.refund"],
        _ => []
    };
}

public sealed record RegisterUserRequest(string TenantId, string Email, string FullName, string Role, bool PasswordlessEnabled, bool MfaEnabled, string? Password);
public sealed record TokenRequest(string Email, string TenantId = "default", string? Password = null, string? PasswordlessCode = null, string? MfaCode = null);
public sealed record RefreshTokenRequest(string RefreshToken);
public sealed record LogoutRequest(string RefreshToken);
public sealed record PasswordlessChallengeRequest(string Email, string TenantId = "default");
public sealed record MfaChallengeRequest(string Email, string TenantId = "default");
public sealed record PermissionResolution(string TenantId, Guid UserId, string[] Roles, string[] Permissions);
public sealed record TokenResponse(string AccessToken, string RefreshToken, Guid UserId, string FullName, string Email, string Role, string TenantId, string[] Permissions);

public sealed class PlatformUser
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool PasswordlessEnabled { get; set; }
    public bool MfaEnabled { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
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

public sealed class PasswordlessChallenge
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

public sealed class MfaChallenge
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string OtpCode { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; set; }
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<PlatformUser> Users => Set<PlatformUser>();
    public DbSet<AuthSession> Sessions => Set<AuthSession>();
    public DbSet<PasswordlessChallenge> PasswordlessChallenges => Set<PasswordlessChallenge>();
    public DbSet<MfaChallenge> MfaChallenges => Set<MfaChallenge>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
    public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999");
}
