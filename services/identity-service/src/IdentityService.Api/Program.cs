using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<IdentityDbContext>();
builder.Services.AddHttpClient<AuthorizationCatalogClient>(c => c.BaseAddress = new Uri(builder.Configuration["DownstreamServices:Authorization"] ?? "http://authorization-service:8080"));
builder.Services.AddHttpClient<NotificationDeliveryService>();
builder.Services.AddSingleton<OidcClientCatalog>();

var app = builder.Build();
app.UsePlatformDefaults();
await app.EnsureDatabaseReadyAsync<IdentityDbContext>();
await SeedIdentityDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "identity-service", flows = new[] { "jwt", "refresh-token", "authorization-code", "passwordless", "mfa", "federation" } }));
app.MapGet("/api/v1/auth/providers", async (IdentityDbContext db) => Results.Ok(await db.FederatedProviders.OrderBy(x => x.Name).ToListAsync()));

app.MapGet("/oauth2/authorize", async ([FromQuery(Name = "client_id")] string clientId, [FromQuery(Name = "redirect_uri")] string redirectUri, [FromQuery] string scope, [FromQuery] string state, [FromQuery] string email, [FromQuery] string tenantId, IdentityDbContext db, OidcClientCatalog clients) =>
{
    if (clients.Resolve(clientId, redirectUri) is null) return Results.BadRequest(new { message = "Unknown client" });
    var user = await db.Users.FirstOrDefaultAsync(x => x.Email == email && x.TenantId == tenantId);
    if (user is null) return Results.NotFound(new { message = "User not found" });
    var code = new AuthorizationCodeGrant { Id = Guid.NewGuid(), ClientId = clientId, RedirectUri = redirectUri, Scope = scope, State = state, TenantId = tenantId, UserId = user.Id, Code = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5) };
    db.AuthorizationCodes.Add(code);
    await db.SaveChangesAsync();
    var sep = redirectUri.Contains('?') ? "&" : "?";
    return Results.Redirect($"{redirectUri}{sep}code={Uri.EscapeDataString(code.Code)}&state={Uri.EscapeDataString(state)}");
});

app.MapPost("/oauth2/token", async ([FromForm] TokenExchangeRequest req, IdentityDbContext db, IConfiguration cfg, AuthorizationCatalogClient authz) =>
{
    if (string.Equals(req.GrantType, "refresh_token", StringComparison.OrdinalIgnoreCase))
    {
        var session = await db.Sessions.FirstOrDefaultAsync(x => x.RefreshToken == req.RefreshToken && x.RefreshTokenExpiresAtUtc > DateTimeOffset.UtcNow);
        if (session is null) return Results.BadRequest(new { message = "Refresh token is invalid or expired" });
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == session.UserId && x.TenantId == session.TenantId);
        if (user is null) return Results.NotFound(new { message = "User not found" });
        var resolution = await authz.ResolvePermissionsAsync(user, session.TenantId);
        session.RefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        session.RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14);
        await db.SaveChangesAsync();
        return Results.Ok(CreateOAuthTokenResponse(user, resolution, session, cfg));
    }

    var code = await db.AuthorizationCodes.FirstOrDefaultAsync(x => x.Code == req.Code && x.ClientId == req.ClientId && x.RedirectUri == req.RedirectUri && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
    if (code is null) return Results.BadRequest(new { message = "Authorization code is invalid or expired" });
    var codeUser = await db.Users.FirstOrDefaultAsync(x => x.Id == code.UserId && x.TenantId == code.TenantId);
    if (codeUser is null) return Results.NotFound(new { message = "User not found" });
    var perm = await authz.ResolvePermissionsAsync(codeUser, code.TenantId);
    var codeSession = CreateSession(codeUser);
    db.Sessions.Add(codeSession);
    db.AuthorizationCodes.Remove(code);
    await db.SaveChangesAsync();
    return Results.Ok(CreateOAuthTokenResponse(codeUser, perm, codeSession, cfg));
});

app.MapPost("/api/v1/auth/federation/start", async ([FromBody] FederatedStartRequest req, IdentityDbContext db) =>
{
    var provider = await db.FederatedProviders.FirstOrDefaultAsync(x => x.Name == req.Provider && x.Enabled);
    return provider is null ? Results.NotFound(new { message = "Provider not found" }) : Results.Ok(new { provider = provider.Name, authorizationUrl = $"{provider.AuthorizationEndpoint}?client_id={Uri.EscapeDataString(provider.ClientId)}&redirect_uri={Uri.EscapeDataString(req.RedirectUri)}&scope=openid%20profile%20email&state={Uri.EscapeDataString(req.State)}" });
});

app.MapPost("/api/v1/auth/federation/callback", async ([FromBody] FederatedCallbackRequest req, IdentityDbContext db) =>
{
    var provider = await db.FederatedProviders.FirstOrDefaultAsync(x => x.Name == req.Provider && x.Enabled);
    if (provider is null) return Results.NotFound(new { message = "Provider not found" });
    var email = req.Email ?? $"{req.ExternalSubject}@{provider.Name.ToLowerInvariant()}.federated";
    var user = await db.Users.FirstOrDefaultAsync(x => x.Email == email && x.TenantId == req.TenantId);
    if (user is null)
    {
        user = new PlatformUser { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = email, FullName = req.DisplayName ?? "Federated User", Role = req.Role ?? "Student", PasswordlessEnabled = true, MfaEnabled = false, PasswordHash = "federated", TotpSecret = TotpUtility.GenerateSecret() };
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    return Results.Ok(new { provider = provider.Name, externalSubject = req.ExternalSubject, email = user.Email, next = $"/oauth2/authorize?client_id=web-admin&redirect_uri={Uri.EscapeDataString(req.RedirectUri)}&scope=openid%20profile%20email&state={Uri.EscapeDataString(req.State)}&email={Uri.EscapeDataString(user.Email)}&tenantId={Uri.EscapeDataString(user.TenantId)}" });
});

app.MapPost("/api/v1/users", async ([FromBody] RegisterUserRequest req, IdentityDbContext db) =>
{
    var user = new PlatformUser { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, FullName = req.FullName, Role = req.Role, PasswordlessEnabled = req.PasswordlessEnabled, MfaEnabled = req.MfaEnabled, PasswordHash = req.Password ?? "dev-password", TotpSecret = TotpUtility.GenerateSecret() };
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Created($"/api/v1/users/{user.Id}", user);
}).RequirePermissions("rbac.manage");

app.MapGet("/api/v1/users", async (HttpContext ctx, IdentityDbContext db) => await db.Users.Where(x => x.TenantId == ctx.GetTenantId()).OrderBy(x => x.FullName).ToListAsync()).RequirePermissions("rbac.manage");
app.MapGet("/api/v1/users/{id:guid}", async (Guid id, HttpContext ctx, IdentityDbContext db) => { var user = await db.Users.FirstOrDefaultAsync(x => x.TenantId == ctx.GetTenantId() && x.Id == id); return user is null ? Results.NotFound() : Results.Ok(user); }).RequirePermissions("rbac.manage");

app.MapGet("/api/v1/auth/mfa/provisioning/{userId:guid}", async (Guid userId, IdentityDbContext db) =>
{
    var user = await db.Users.FirstOrDefaultAsync(x => x.Id == userId);
    if (user is null) return Results.NotFound();
    user.TotpSecret ??= TotpUtility.GenerateSecret();
    await db.SaveChangesAsync();
    return Results.Ok(new { issuer = "University360", secret = user.TotpSecret, otpauthUri = TotpUtility.GetProvisioningUri(user.Email, user.TotpSecret) });
}).RequirePermissions("rbac.manage");

app.MapPost("/api/v1/auth/passwordless/challenge", async ([FromBody] PasswordlessChallengeRequest req, IdentityDbContext db, NotificationDeliveryService delivery) =>
{
    var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
    if (user is null || !user.PasswordlessEnabled) return Results.BadRequest(new { message = "Passwordless login is not enabled for this user." });
    var challenge = new PasswordlessChallenge { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, Code = GenerateOneTimeCode(), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5), Channel = req.Channel };
    db.PasswordlessChallenges.Add(challenge);
    await db.SaveChangesAsync();
    var sent = await delivery.DeliverAsync(req.Email, req.Channel, $"University360 sign-in code: {challenge.Code}", db);
    return Results.Ok(new { challengeId = challenge.Id, expiresAtUtc = challenge.ExpiresAtUtc, delivery = sent });
});

app.MapPost("/api/v1/auth/mfa/challenge", async ([FromBody] MfaChallengeRequest req, IdentityDbContext db, NotificationDeliveryService delivery) =>
{
    var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
    if (user is null || !user.MfaEnabled) return Results.BadRequest(new { message = "MFA is not enabled for this user." });
    var challenge = new MfaChallenge { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, OtpCode = GenerateOneTimeCode(), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5), Channel = req.Channel };
    db.MfaChallenges.Add(challenge);
    await db.SaveChangesAsync();
    var sent = await delivery.DeliverAsync(req.Email, req.Channel, $"University360 MFA code: {challenge.OtpCode}", db);
    return Results.Ok(new { challengeId = challenge.Id, expiresAtUtc = challenge.ExpiresAtUtc, delivery = sent });
});

app.MapGet("/api/v1/auth/delivery-log", async (IdentityDbContext db) => await db.DeliveryLogs.OrderByDescending(x => x.CreatedAtUtc).Take(50).ToListAsync()).RequirePermissions("rbac.manage");

app.MapPost("/api/v1/auth/token", async ([FromBody] TokenRequest req, IdentityDbContext db, IConfiguration cfg, AuthorizationCatalogClient authz) =>
{
    var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
    if (user is null) return Results.NotFound(new { message = "User not found" });

    if (user.PasswordlessEnabled && !string.IsNullOrWhiteSpace(req.PasswordlessCode))
    {
        var passChallenge = await db.PasswordlessChallenges.OrderByDescending(x => x.ExpiresAtUtc).FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId && x.Code == req.PasswordlessCode && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
        if (passChallenge is null) return Results.BadRequest(new { message = "Invalid passwordless code" });
    }
    else if (!string.Equals(user.PasswordHash, req.Password, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { message = "Invalid credentials" });
    }

    if (user.MfaEnabled && !TotpUtility.IsValidCode(user.TotpSecret ?? string.Empty, req.MfaCode))
    {
        var mfaChallenge = await db.MfaChallenges.OrderByDescending(x => x.ExpiresAtUtc).FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId && x.OtpCode == req.MfaCode && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
        if (mfaChallenge is null) return Results.BadRequest(new { message = "MFA verification required" });
    }

    var resolution = await authz.ResolvePermissionsAsync(user, req.TenantId);
    var session = CreateSession(user);
    db.Sessions.Add(session);
    await db.SaveChangesAsync();
    return Results.Ok(CreateTokenResponse(user, resolution, session, cfg));
});

app.MapPost("/api/v1/auth/refresh", async ([FromBody] RefreshTokenRequest req, IdentityDbContext db, IConfiguration cfg, AuthorizationCatalogClient authz) =>
{
    var session = await db.Sessions.FirstOrDefaultAsync(x => x.RefreshToken == req.RefreshToken && x.RefreshTokenExpiresAtUtc > DateTimeOffset.UtcNow);
    if (session is null) return Results.BadRequest(new { message = "Refresh token is invalid or expired" });
    var user = await db.Users.FirstOrDefaultAsync(x => x.Id == session.UserId && x.TenantId == session.TenantId);
    if (user is null) return Results.NotFound(new { message = "User not found" });
    var resolution = await authz.ResolvePermissionsAsync(user, session.TenantId);
    session.RefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    session.RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14);
    await db.SaveChangesAsync();
    return Results.Ok(CreateTokenResponse(user, resolution, session, cfg));
});

app.MapPost("/api/v1/auth/logout", async ([FromBody] LogoutRequest req, IdentityDbContext db) => { var session = await db.Sessions.FirstOrDefaultAsync(x => x.RefreshToken == req.RefreshToken); if (session is null) return Results.NoContent(); db.Sessions.Remove(session); await db.SaveChangesAsync(); return Results.NoContent(); });
app.MapGet("/api/v1/roles", () => Results.Ok(new[] { "Student", "Professor", "Principal", "DepartmentHead", "Admin", "FinanceStaff" }));
app.Run();

static async Task SeedIdentityDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    if (!await db.FederatedProviders.AnyAsync()) db.FederatedProviders.AddRange([new FederatedAuthProvider { Id = Guid.NewGuid(), Name = "Google", AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth", TokenEndpoint = "https://oauth2.googleapis.com/token", ClientId = "google-client-id", Enabled = true }, new FederatedAuthProvider { Id = Guid.NewGuid(), Name = "MicrosoftEntraId", AuthorizationEndpoint = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", TokenEndpoint = "https://login.microsoftonline.com/common/oauth2/v2.0/token", ClientId = "entra-client-id", Enabled = true }]);
    if (await db.Users.AnyAsync()) { await db.SaveChangesAsync(); return; }
    db.Users.AddRange([new PlatformUser { Id = KnownUsers.StudentId, TenantId = "default", Email = "student@university360.edu", FullName = "Aarav Sharma", Role = "Student", PasswordlessEnabled = true, MfaEnabled = false, PasswordHash = "student-pass", TotpSecret = TotpUtility.GenerateSecret() }, new PlatformUser { Id = KnownUsers.ProfessorId, TenantId = "default", Email = "professor@university360.edu", FullName = "Dr. Meera Iyer", Role = "Professor", PasswordlessEnabled = true, MfaEnabled = true, PasswordHash = "professor-pass", TotpSecret = TotpUtility.GenerateSecret() }, new PlatformUser { Id = KnownUsers.AdminId, TenantId = "default", Email = "principal@university360.edu", FullName = "Prof. Kavita Menon", Role = "Principal", PasswordlessEnabled = true, MfaEnabled = true, PasswordHash = "principal-pass", TotpSecret = TotpUtility.GenerateSecret() }]);
    await db.SaveChangesAsync();
}

static AuthSession CreateSession(PlatformUser user) => new() { Id = Guid.NewGuid(), TenantId = user.TenantId, UserId = user.Id, RefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)), RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14), CreatedAtUtc = DateTimeOffset.UtcNow };
static string GenerateOneTimeCode() => RandomNumberGenerator.GetInt32(100000, 999999).ToString();
static TokenResponse CreateTokenResponse(PlatformUser user, PermissionResolution resolution, AuthSession session, IConfiguration cfg) => new(CreateJwt(user, resolution, session, cfg), session.RefreshToken, user.Id, user.FullName, user.Email, user.Role, user.TenantId, resolution.Permissions);
static object CreateOAuthTokenResponse(PlatformUser user, PermissionResolution resolution, AuthSession session, IConfiguration cfg) { var accessToken = CreateJwt(user, resolution, session, cfg); return new { token_type = "Bearer", access_token = accessToken, refresh_token = session.RefreshToken, expires_in = 1800, id_token = accessToken, scope = "openid profile email offline_access" }; }
static string CreateJwt(PlatformUser user, PermissionResolution resolution, AuthSession session, IConfiguration cfg) { var key = cfg["Platform:Jwt:SigningKey"] ?? "development-signing-key-please-change"; var claims = new List<Claim> { new(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Email, user.Email), new(ClaimTypes.Role, user.Role), new("role", user.Role), new("tenant_id", user.TenantId), new("session_id", session.Id.ToString()) }; claims.AddRange(resolution.Permissions.Select(p => new Claim("permission", p))); var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256); var token = new JwtSecurityToken(cfg["Platform:Jwt:Authority"] ?? "https://identity.university360.local", cfg["Platform:Jwt:Audience"] ?? "university360-api", claims, expires: DateTime.UtcNow.AddMinutes(30), signingCredentials: creds); return new JwtSecurityTokenHandler().WriteToken(token); }

public sealed class OidcClientCatalog { private static readonly OidcClient[] Clients = [new("web-admin", "University360 Web Admin", "https://localhost:3000/auth/callback"), new("mobile-app", "University360 Mobile", "exp://127.0.0.1:8081/--/auth/callback")]; public OidcClient? Resolve(string clientId, string redirectUri) => Clients.FirstOrDefault(c => string.Equals(c.ClientId, clientId, StringComparison.OrdinalIgnoreCase) && string.Equals(c.RedirectUri, redirectUri, StringComparison.OrdinalIgnoreCase)); }
public sealed record OidcClient(string ClientId, string Name, string RedirectUri);
public sealed class NotificationDeliveryService(HttpClient httpClient, IConfiguration configuration, ILogger<NotificationDeliveryService> logger)
{
    public async Task<DeliveryLog> DeliverAsync(string recipient, string channel, string message, IdentityDbContext db)
    {
        var log = new DeliveryLog { Id = Guid.NewGuid(), Recipient = recipient, Channel = channel, MessagePreview = message.Length > 64 ? message[..64] : message, Provider = channel.Equals("sms", StringComparison.OrdinalIgnoreCase) ? "ConfiguredSmsProvider" : "ConfiguredEmailProvider", Status = "Queued", CreatedAtUtc = DateTimeOffset.UtcNow };
        try
        {
            if (channel.Equals("email", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(configuration["AuthDelivery:Email:SmtpHost"]))
            {
                using var smtp = new SmtpClient(configuration["AuthDelivery:Email:SmtpHost"], int.TryParse(configuration["AuthDelivery:Email:Port"], out var port) ? port : 25) { Credentials = new NetworkCredential(configuration["AuthDelivery:Email:Username"], configuration["AuthDelivery:Email:Password"]), EnableSsl = true };
                await smtp.SendMailAsync(new MailMessage(configuration["AuthDelivery:Email:From"] ?? "noreply@university360.local", recipient, "University360 Authentication", message));
                log.Status = "Delivered";
            }
            else if (channel.Equals("sms", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(configuration["AuthDelivery:Sms:Endpoint"]))
            {
                using var response = await httpClient.PostAsJsonAsync(configuration["AuthDelivery:Sms:Endpoint"], new { recipient, message });
                log.Status = response.IsSuccessStatusCode ? "Delivered" : "Failed";
            }
            else
            {
                logger.LogInformation("Fallback delivery for {Channel} to {Recipient}: {Message}", channel, recipient, message);
                log.Status = "Delivered";
            }
        }
        catch (Exception exception) { logger.LogWarning(exception, "Authentication delivery failed"); log.Status = "Failed"; }
        db.DeliveryLogs.Add(log); await db.SaveChangesAsync(); return log;
    }
}

public static class TotpUtility
{
    public static string GenerateSecret() { const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; var bytes = RandomNumberGenerator.GetBytes(20); var chars = new char[32]; for (var i = 0; i < chars.Length; i++) chars[i] = alphabet[bytes[i % bytes.Length] % alphabet.Length]; return new string(chars); }
    public static string GetProvisioningUri(string email, string secret) => $"otpauth://totp/University360:{Uri.EscapeDataString(email)}?secret={secret}&issuer=University360";
    public static bool IsValidCode(string secret, string? code) => !string.IsNullOrWhiteSpace(secret) && !string.IsNullOrWhiteSpace(code) && Enumerable.Range(-1, 3).Any(offset => string.Equals(ComputeCode(secret, DateTimeOffset.UtcNow.AddSeconds(offset * 30)), code, StringComparison.Ordinal));
    private static string ComputeCode(string secret, DateTimeOffset timestamp) { var counter = BitConverter.GetBytes(IPAddress.HostToNetworkOrder(timestamp.ToUnixTimeSeconds() / 30)); using var hmac = new HMACSHA1(Encoding.ASCII.GetBytes(secret)); var hash = hmac.ComputeHash(counter); var offset = hash[^1] & 0x0F; var binary = ((hash[offset] & 0x7F) << 24) | ((hash[offset + 1] & 0xFF) << 16) | ((hash[offset + 2] & 0xFF) << 8) | (hash[offset + 3] & 0xFF); return (binary % 1_000_000).ToString("D6"); }
}

public sealed class AuthorizationCatalogClient(HttpClient httpClient)
{
    public async Task<PermissionResolution> ResolvePermissionsAsync(PlatformUser user, string tenantId)
    {
        try { var response = await httpClient.GetFromJsonAsync<PermissionResolution>($"/internal/users/{user.Id}/permissions?role={Uri.EscapeDataString(user.Role)}&tenantId={Uri.EscapeDataString(tenantId)}"); return response ?? new PermissionResolution(tenantId, user.Id, [user.Role], []); }
        catch { return new PermissionResolution(tenantId, user.Id, [user.Role], user.Role switch { "Student" => ["attendance.view", "results.view"], "Professor" => ["attendance.view", "attendance.mark", "announcements.create", "files.upload"], "Principal" => ["attendance.view", "results.view", "results.publish", "analytics.view", "announcements.create"], "Admin" => ["rbac.manage", "analytics.view", "finance.manage"], "FinanceStaff" => ["finance.manage", "payments.refund"], _ => [] }); }
    }
}

public sealed record RegisterUserRequest(string TenantId, string Email, string FullName, string Role, bool PasswordlessEnabled, bool MfaEnabled, string? Password);
public sealed record TokenRequest(string Email, string TenantId = "default", string? Password = null, string? PasswordlessCode = null, string? MfaCode = null);
public sealed record TokenExchangeRequest([FromForm(Name = "grant_type")] string GrantType, [FromForm(Name = "client_id")] string? ClientId, [FromForm(Name = "redirect_uri")] string? RedirectUri, [FromForm(Name = "code")] string? Code, [FromForm(Name = "refresh_token")] string? RefreshToken);
public sealed record RefreshTokenRequest(string RefreshToken);
public sealed record LogoutRequest(string RefreshToken);
public sealed record PasswordlessChallengeRequest(string Email, string TenantId = "default", string Channel = "email");
public sealed record MfaChallengeRequest(string Email, string TenantId = "default", string Channel = "email");
public sealed record FederatedStartRequest(string Provider, string RedirectUri, string State);
public sealed record FederatedCallbackRequest(string Provider, string RedirectUri, string State, string TenantId, string ExternalSubject, string? Email, string? DisplayName, string? Role);
public sealed record PermissionResolution(string TenantId, Guid UserId, string[] Roles, string[] Permissions);
public sealed record TokenResponse(string AccessToken, string RefreshToken, Guid UserId, string FullName, string Email, string Role, string TenantId, string[] Permissions);

public sealed class PlatformUser { public Guid Id { get; set; } public string TenantId { get; set; } = string.Empty; public string Email { get; set; } = string.Empty; public string FullName { get; set; } = string.Empty; public string Role { get; set; } = string.Empty; public bool PasswordlessEnabled { get; set; } public bool MfaEnabled { get; set; } public string PasswordHash { get; set; } = string.Empty; public string? TotpSecret { get; set; } }
public sealed class AuthSession { public Guid Id { get; set; } public string TenantId { get; set; } = string.Empty; public Guid UserId { get; set; } public string RefreshToken { get; set; } = string.Empty; public DateTimeOffset RefreshTokenExpiresAtUtc { get; set; } public DateTimeOffset CreatedAtUtc { get; set; } }
public sealed class AuthorizationCodeGrant { public Guid Id { get; set; } public Guid UserId { get; set; } public string TenantId { get; set; } = string.Empty; public string ClientId { get; set; } = string.Empty; public string RedirectUri { get; set; } = string.Empty; public string Scope { get; set; } = string.Empty; public string State { get; set; } = string.Empty; public string Code { get; set; } = string.Empty; public DateTimeOffset ExpiresAtUtc { get; set; } }
public sealed class PasswordlessChallenge { public Guid Id { get; set; } public string TenantId { get; set; } = string.Empty; public string Email { get; set; } = string.Empty; public string Code { get; set; } = string.Empty; public string Channel { get; set; } = "email"; public DateTimeOffset ExpiresAtUtc { get; set; } }
public sealed class MfaChallenge { public Guid Id { get; set; } public string TenantId { get; set; } = string.Empty; public string Email { get; set; } = string.Empty; public string OtpCode { get; set; } = string.Empty; public string Channel { get; set; } = "email"; public DateTimeOffset ExpiresAtUtc { get; set; } }
public sealed class DeliveryLog { public Guid Id { get; set; } public string Recipient { get; set; } = string.Empty; public string Channel { get; set; } = string.Empty; public string Provider { get; set; } = string.Empty; public string MessagePreview { get; set; } = string.Empty; public string Status { get; set; } = "Queued"; public DateTimeOffset CreatedAtUtc { get; set; } }
public sealed class FederatedAuthProvider { public Guid Id { get; set; } public string Name { get; set; } = string.Empty; public string AuthorizationEndpoint { get; set; } = string.Empty; public string TokenEndpoint { get; set; } = string.Empty; public string ClientId { get; set; } = string.Empty; public bool Enabled { get; set; } }

static class TenantExtensions { public static string GetTenantId(this HttpContext ctx) => ctx.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default"; }
public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options) { public DbSet<PlatformUser> Users => Set<PlatformUser>(); public DbSet<AuthSession> Sessions => Set<AuthSession>(); public DbSet<AuthorizationCodeGrant> AuthorizationCodes => Set<AuthorizationCodeGrant>(); public DbSet<PasswordlessChallenge> PasswordlessChallenges => Set<PasswordlessChallenge>(); public DbSet<MfaChallenge> MfaChallenges => Set<MfaChallenge>(); public DbSet<DeliveryLog> DeliveryLogs => Set<DeliveryLog>(); public DbSet<FederatedAuthProvider> FederatedProviders => Set<FederatedAuthProvider>(); }
public static class KnownUsers { public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123"); public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456"); public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999"); }
