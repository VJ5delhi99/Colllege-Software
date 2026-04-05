using System.Net;
using System.Net.Mail;
using IdentityService.Api.Application;
using IdentityService.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Api.Infrastructure;

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<PlatformUser> Users => Set<PlatformUser>();
    public DbSet<AuthSession> Sessions => Set<AuthSession>();
    public DbSet<AuthorizationCodeGrant> AuthorizationCodes => Set<AuthorizationCodeGrant>();
    public DbSet<PasswordlessChallenge> PasswordlessChallenges => Set<PasswordlessChallenge>();
    public DbSet<MfaChallenge> MfaChallenges => Set<MfaChallenge>();
    public DbSet<PasswordResetChallenge> PasswordResetChallenges => Set<PasswordResetChallenge>();
    public DbSet<EmailVerificationChallenge> EmailVerificationChallenges => Set<EmailVerificationChallenge>();
    public DbSet<DeliveryLog> DeliveryLogs => Set<DeliveryLog>();
    public DbSet<FederatedAuthProvider> FederatedProviders => Set<FederatedAuthProvider>();
    public DbSet<IdentityAuditLog> AuditLogs => Set<IdentityAuditLog>();
}

public sealed class OidcClientCatalog
{
    private static readonly OidcClient[] Clients = [new("web-admin", "University360 Web Admin", "https://localhost:3000/auth/callback"), new("mobile-app", "University360 Mobile", "exp://127.0.0.1:8081/--/auth/callback")];
    public OidcClient? Resolve(string clientId, string redirectUri) => Clients.FirstOrDefault(c => string.Equals(c.ClientId, clientId, StringComparison.OrdinalIgnoreCase) && string.Equals(c.RedirectUri, redirectUri, StringComparison.OrdinalIgnoreCase));
}

public sealed record OidcClient(string ClientId, string Name, string RedirectUri);

public sealed class FederationReadinessCatalog(IConfiguration configuration)
{
    public FederationProviderReadiness Describe(FederatedAuthProvider provider)
    {
        var prefix = $"Federation:Providers:{provider.Name}:";
        var clientSecret = configuration[$"{prefix}ClientSecret"];
        var callbackUrl = configuration[$"{prefix}CallbackUrl"];
        var enabledSetting = configuration[$"{prefix}Enabled"];
        var enabled = string.IsNullOrWhiteSpace(enabledSetting)
            ? provider.Enabled
            : bool.TryParse(enabledSetting, out var parsedEnabled) && parsedEnabled;

        return new FederationProviderReadiness(
            provider.Name,
            enabled,
            !string.IsNullOrWhiteSpace(provider.ClientId),
            !string.IsNullOrWhiteSpace(clientSecret),
            !string.IsNullOrWhiteSpace(provider.AuthorizationEndpoint),
            !string.IsNullOrWhiteSpace(provider.TokenEndpoint),
            !string.IsNullOrWhiteSpace(callbackUrl),
            DetermineStatus(enabled, provider, clientSecret, callbackUrl),
            callbackUrl);
    }

    private static string DetermineStatus(FederatedAuthProvider provider, string? clientSecret, string? callbackUrl)
    {
        if (string.IsNullOrWhiteSpace(provider.ClientId) ||
            string.IsNullOrWhiteSpace(provider.AuthorizationEndpoint) ||
            string.IsNullOrWhiteSpace(provider.TokenEndpoint) ||
            string.IsNullOrWhiteSpace(clientSecret) ||
            string.IsNullOrWhiteSpace(callbackUrl))
        {
            return "Configuration Required";
        }

        return "Ready";
    }

    private static string DetermineStatus(bool enabled, FederatedAuthProvider provider, string? clientSecret, string? callbackUrl)
    {
        if (!enabled)
        {
            return "Disabled";
        }

        return DetermineStatus(provider, clientSecret, callbackUrl);
    }
}

public sealed record FederationProviderReadiness(
    string Name,
    bool Enabled,
    bool ClientIdConfigured,
    bool ClientSecretConfigured,
    bool AuthorizationEndpointConfigured,
    bool TokenEndpointConfigured,
    bool CallbackUrlConfigured,
    string Status,
    string? CallbackUrl);

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
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Authentication delivery failed");
            log.Status = "Failed";
        }

        db.DeliveryLogs.Add(log);
        await db.SaveChangesAsync();
        return log;
    }
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
            return new PermissionResolution(tenantId, user.Id, [user.Role], user.Role switch { "Student" => ["attendance.view", "results.view"], "Professor" => ["attendance.view", "attendance.mark", "announcements.create", "files.upload"], "Principal" => ["attendance.view", "results.view", "results.publish", "analytics.view", "announcements.create"], "Admin" => ["rbac.manage", "analytics.view", "finance.manage"], "FinanceStaff" => ["finance.manage", "payments.refund"], _ => [] });
        }
    }
}

public static class IdentitySeeder
{
    public static async Task SeedIdentityDataAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        if (!await db.FederatedProviders.AnyAsync()) db.FederatedProviders.AddRange([new FederatedAuthProvider { Id = Guid.NewGuid(), Name = "Google", AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth", TokenEndpoint = "https://oauth2.googleapis.com/token", ClientId = "google-client-id", Enabled = true }, new FederatedAuthProvider { Id = Guid.NewGuid(), Name = "MicrosoftEntraId", AuthorizationEndpoint = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", TokenEndpoint = "https://login.microsoftonline.com/common/oauth2/v2.0/token", ClientId = "entra-client-id", Enabled = true }]);
        if (await db.Users.AnyAsync()) { await db.SaveChangesAsync(); return; }
        db.Users.AddRange([new PlatformUser { Id = KnownUsers.StudentId, TenantId = "default", Email = "student@university360.edu", FullName = "Aarav Sharma", Role = "Student", PasswordlessEnabled = true, MfaEnabled = false, EmailVerified = true, PasswordHash = PasswordUtility.HashPassword("student-pass"), TotpSecret = TotpUtility.GenerateSecret() }, new PlatformUser { Id = KnownUsers.ProfessorId, TenantId = "default", Email = "professor@university360.edu", FullName = "Dr. Meera Iyer", Role = "Professor", PasswordlessEnabled = true, MfaEnabled = true, EmailVerified = true, PasswordHash = PasswordUtility.HashPassword("professor-pass"), TotpSecret = TotpUtility.GenerateSecret() }, new PlatformUser { Id = KnownUsers.AdminId, TenantId = "default", Email = "principal@university360.edu", FullName = "Prof. Kavita Menon", Role = "Principal", PasswordlessEnabled = true, MfaEnabled = true, EmailVerified = true, PasswordHash = PasswordUtility.HashPassword("principal-pass"), TotpSecret = TotpUtility.GenerateSecret() }, new PlatformUser { Id = KnownUsers.FinanceStaffId, TenantId = "default", Email = "finance@university360.edu", FullName = "Riya Kapoor", Role = "FinanceStaff", PasswordlessEnabled = false, MfaEnabled = false, EmailVerified = true, PasswordHash = PasswordUtility.HashPassword("finance-pass"), TotpSecret = TotpUtility.GenerateSecret() }]);
        await db.SaveChangesAsync();
    }
}
