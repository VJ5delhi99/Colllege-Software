using System.Security.Claims;
using IdentityService.Api.Application;
using IdentityService.Api.Domain;
using IdentityService.Api.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

namespace IdentityService.Api.Api;

public static class IdentityEndpoints
{
    public static void MapIdentityEndpoints(this WebApplication app)
    {
        app.MapGet("/", () => Results.Ok(new { service = "identity-service", flows = new[] { "jwt", "refresh-token", "authorization-code", "passwordless", "mfa", "federation" } }));
        app.MapGet("/api/v1/auth/providers", async (IdentityDbContext db) => Results.Ok(await db.FederatedProviders.OrderBy(x => x.Name).ToListAsync()));

        app.MapGet("/oauth2/authorize", async (HttpContext httpContext, [FromQuery(Name = "client_id")] string clientId, [FromQuery(Name = "redirect_uri")] string redirectUri, [FromQuery] string scope, [FromQuery] string state, [FromQuery] string tenantId, IdentityDbContext db, OidcClientCatalog clients) =>
        {
            if (httpContext.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            var authenticatedUserId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var authenticatedTenantId = httpContext.User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrWhiteSpace(authenticatedUserId) || string.IsNullOrWhiteSpace(authenticatedTenantId) || !string.Equals(authenticatedTenantId, tenantId, StringComparison.Ordinal)) return Results.Forbid();
            if (clients.Resolve(clientId, redirectUri) is null) return Results.BadRequest(new { message = "Unknown client" });
            var user = await db.Users.FirstOrDefaultAsync(x => x.Id == Guid.Parse(authenticatedUserId) && x.TenantId == tenantId);
            if (user is null) return Results.NotFound(new { message = "User not found" });
            var code = new AuthorizationCodeGrant { Id = Guid.NewGuid(), ClientId = clientId, RedirectUri = redirectUri, Scope = scope, State = state, TenantId = tenantId, UserId = user.Id, Code = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5) };
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
                session.RefreshToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
                session.RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14);
                await db.SaveChangesAsync();
                return Results.Ok(TokenFactory.CreateOAuthTokenResponse(user, resolution, session, cfg));
            }

            var code = await db.AuthorizationCodes.FirstOrDefaultAsync(x => x.Code == req.Code && x.ClientId == req.ClientId && x.RedirectUri == req.RedirectUri && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
            if (code is null) return Results.BadRequest(new { message = "Authorization code is invalid or expired" });
            var codeUser = await db.Users.FirstOrDefaultAsync(x => x.Id == code.UserId && x.TenantId == code.TenantId);
            if (codeUser is null) return Results.NotFound(new { message = "User not found" });
            var perm = await authz.ResolvePermissionsAsync(codeUser, code.TenantId);
            var codeSession = IdentitySessionFactory.CreateSession(codeUser);
            db.Sessions.Add(codeSession);
            db.AuthorizationCodes.Remove(code);
            await db.SaveChangesAsync();
            return Results.Ok(TokenFactory.CreateOAuthTokenResponse(codeUser, perm, codeSession, cfg));
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
            return Results.StatusCode(StatusCodes.Status501NotImplemented);
        });

        app.MapPost("/api/v1/users", async ([FromBody] RegisterUserRequest req, IdentityDbContext db) =>
        {
            var user = new PlatformUser { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, FullName = req.FullName, Role = req.Role, PasswordlessEnabled = req.PasswordlessEnabled, MfaEnabled = req.MfaEnabled, PasswordHash = PasswordUtility.HashPassword(req.Password ?? throw new BadHttpRequestException("Password is required.")), TotpSecret = TotpUtility.GenerateSecret() };
            db.Users.Add(user);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.user.created", user.Id.ToString(), "rbac.manage", $"User {user.Email} created with role {user.Role}."));
            await db.SaveChangesAsync();
            return Results.Created($"/api/v1/users/{user.Id}", UserMapper.ToUserResponse(user));
        }).RequirePermissions("rbac.manage").RequireRateLimiting("api");

        app.MapGet("/api/v1/users", async (HttpContext ctx, IdentityDbContext db) =>
        {
            var tenantId = ctx.GetValidatedTenantId();
            var users = await db.Users.Where(x => x.TenantId == tenantId).OrderBy(x => x.FullName).ToListAsync();
            return Results.Ok(users.Select(UserMapper.ToUserResponse));
        }).RequirePermissions("rbac.manage");

        app.MapGet("/api/v1/users/{id:guid}", async (Guid id, HttpContext ctx, IdentityDbContext db) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(x => x.TenantId == ctx.GetValidatedTenantId() && x.Id == id);
            return user is null ? Results.NotFound() : Results.Ok(UserMapper.ToUserResponse(user));
        }).RequirePermissions("rbac.manage");

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
            var challenge = new PasswordlessChallenge { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, Code = IdentitySessionFactory.GenerateOneTimeCode(), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5), Channel = req.Channel };
            db.PasswordlessChallenges.Add(challenge);
            await db.SaveChangesAsync();
            var sent = await delivery.DeliverAsync(req.Email, req.Channel, $"University360 sign-in code: {challenge.Code}", db);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.passwordless.challenge-issued", challenge.Id.ToString(), req.Email, $"Passwordless challenge sent over {req.Channel}."));
            await db.SaveChangesAsync();
            return Results.Ok(new { challengeId = challenge.Id, expiresAtUtc = challenge.ExpiresAtUtc, delivery = sent });
        }).RequireRateLimiting("api");

        app.MapPost("/api/v1/auth/password-reset/request", async ([FromBody] PasswordResetRequest req, IdentityDbContext db, NotificationDeliveryService delivery) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
            if (user is null) return Results.Ok(new { message = "If the account exists, a reset code has been issued." });
            var challenge = new PasswordResetChallenge { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, Code = IdentitySessionFactory.GenerateOneTimeCode(), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(15) };
            db.PasswordResetChallenges.Add(challenge);
            await db.SaveChangesAsync();
            var deliveryLog = await delivery.DeliverAsync(req.Email, "email", $"University360 password reset code: {challenge.Code}", db);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.password-reset.requested", challenge.Id.ToString(), req.Email, "Password reset challenge issued."));
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "If the account exists, a reset code has been issued.", delivery = deliveryLog });
        }).RequireRateLimiting("api");

        app.MapPost("/api/v1/auth/password-reset/confirm", async ([FromBody] PasswordResetConfirmRequest req, IdentityDbContext db) =>
        {
            var challenge = await db.PasswordResetChallenges.OrderByDescending(x => x.ExpiresAtUtc).FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId && x.Code == req.Code && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
            if (challenge is null) return Results.BadRequest(new { message = "Reset code is invalid or expired." });
            var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
            if (user is null) return Results.BadRequest(new { message = "Reset code is invalid or expired." });
            user.PasswordHash = PasswordUtility.HashPassword(req.NewPassword);
            db.PasswordResetChallenges.Remove(challenge);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.password-reset.completed", user.Id.ToString(), req.Email, "Password reset completed successfully."));
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Password updated successfully." });
        }).RequireRateLimiting("api");

        app.MapPost("/api/v1/auth/mfa/challenge", async ([FromBody] MfaChallengeRequest req, IdentityDbContext db, NotificationDeliveryService delivery) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
            if (user is null || !user.MfaEnabled) return Results.BadRequest(new { message = "MFA is not enabled for this user." });
            var challenge = new MfaChallenge { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, OtpCode = IdentitySessionFactory.GenerateOneTimeCode(), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(5), Channel = req.Channel };
            db.MfaChallenges.Add(challenge);
            await db.SaveChangesAsync();
            var sent = await delivery.DeliverAsync(req.Email, req.Channel, $"University360 MFA code: {challenge.OtpCode}", db);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.mfa.challenge-issued", challenge.Id.ToString(), req.Email, $"MFA challenge sent over {req.Channel}."));
            await db.SaveChangesAsync();
            return Results.Ok(new { challengeId = challenge.Id, expiresAtUtc = challenge.ExpiresAtUtc, delivery = sent });
        }).RequireRateLimiting("api");

        app.MapPost("/api/v1/auth/email-verification/send", async ([FromBody] EmailVerificationSendRequest req, IdentityDbContext db, NotificationDeliveryService delivery) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
            if (user is null) return Results.Ok(new { message = "If the account exists, a verification code has been issued." });
            var challenge = new EmailVerificationChallenge { Id = Guid.NewGuid(), TenantId = req.TenantId, Email = req.Email, Code = IdentitySessionFactory.GenerateOneTimeCode(), ExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(30) };
            db.EmailVerificationChallenges.Add(challenge);
            await db.SaveChangesAsync();
            var deliveryLog = await delivery.DeliverAsync(req.Email, "email", $"University360 email verification code: {challenge.Code}", db);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.email-verification.requested", challenge.Id.ToString(), req.Email, "Email verification challenge issued."));
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "If the account exists, a verification code has been issued.", delivery = deliveryLog });
        }).RequireRateLimiting("api");

        app.MapPost("/api/v1/auth/email-verification/confirm", async ([FromBody] EmailVerificationConfirmRequest req, IdentityDbContext db) =>
        {
            var challenge = await db.EmailVerificationChallenges.OrderByDescending(x => x.ExpiresAtUtc).FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId && x.Code == req.Code && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
            if (challenge is null) return Results.BadRequest(new { message = "Verification code is invalid or expired." });
            var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
            if (user is null) return Results.BadRequest(new { message = "Verification code is invalid or expired." });
            user.EmailVerified = true;
            db.EmailVerificationChallenges.Remove(challenge);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.email-verified", user.Id.ToString(), req.Email, "Email address verified."));
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Email verified successfully." });
        }).RequireRateLimiting("api");

        app.MapGet("/api/v1/auth/delivery-log", async (IdentityDbContext db) => await db.DeliveryLogs.OrderByDescending(x => x.CreatedAtUtc).Take(50).ToListAsync()).RequirePermissions("rbac.manage");

        app.MapGet("/api/v1/audit-logs", async (HttpContext ctx, IdentityDbContext db, int page = 1, int pageSize = 20) =>
        {
            var tenantId = ctx.GetValidatedTenantId();
            var safePage = Math.Max(page, 1);
            var safePageSize = Math.Clamp(pageSize, 1, 100);
            var query = db.AuditLogs.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.CreatedAtUtc);
            var total = await query.CountAsync();
            var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
            return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
        }).RequirePermissions("rbac.manage");

        app.MapPost("/api/v1/auth/token", async ([FromBody] TokenRequest req, IdentityDbContext db, IConfiguration cfg, AuthorizationCatalogClient authz) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId);
            if (user is null) return Results.BadRequest(new { message = "Invalid credentials" });
            if (!user.EmailVerified) return Results.BadRequest(new { message = "Email verification is required before sign-in." });

            if (user.PasswordlessEnabled && !string.IsNullOrWhiteSpace(req.PasswordlessCode))
            {
                var passChallenge = await db.PasswordlessChallenges.OrderByDescending(x => x.ExpiresAtUtc).FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId && x.Code == req.PasswordlessCode && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
                if (passChallenge is null) return Results.BadRequest(new { message = "Invalid passwordless code" });
                db.PasswordlessChallenges.Remove(passChallenge);
            }
            else if (string.IsNullOrWhiteSpace(req.Password) || !PasswordUtility.VerifyPassword(user.PasswordHash, req.Password))
            {
                return Results.BadRequest(new { message = "Invalid credentials" });
            }

            if (user.MfaEnabled && !TotpUtility.IsValidCode(user.TotpSecret ?? string.Empty, req.MfaCode))
            {
                var mfaChallenge = await db.MfaChallenges.OrderByDescending(x => x.ExpiresAtUtc).FirstOrDefaultAsync(x => x.Email == req.Email && x.TenantId == req.TenantId && x.OtpCode == req.MfaCode && x.ExpiresAtUtc > DateTimeOffset.UtcNow);
                if (mfaChallenge is null) return Results.BadRequest(new { message = "MFA verification required" });
                db.MfaChallenges.Remove(mfaChallenge);
            }

            var resolution = await authz.ResolvePermissionsAsync(user, req.TenantId);
            var session = IdentitySessionFactory.CreateSession(user);
            db.Sessions.Add(session);
            db.AuditLogs.Add(IdentityAuditLog.Create(req.TenantId, "identity.sign-in.succeeded", session.Id.ToString(), user.Email, $"User signed in with role {user.Role}."));
            await db.SaveChangesAsync();
            return Results.Ok(TokenFactory.CreateTokenResponse(user, resolution, session, cfg));
        }).RequireRateLimiting("api");

        app.MapPost("/api/v1/auth/refresh", async ([FromBody] RefreshTokenRequest req, IdentityDbContext db, IConfiguration cfg, AuthorizationCatalogClient authz) =>
        {
            var session = await db.Sessions.FirstOrDefaultAsync(x => x.RefreshToken == req.RefreshToken && x.RefreshTokenExpiresAtUtc > DateTimeOffset.UtcNow);
            if (session is null) return Results.BadRequest(new { message = "Refresh token is invalid or expired" });
            var user = await db.Users.FirstOrDefaultAsync(x => x.Id == session.UserId && x.TenantId == session.TenantId);
            if (user is null) return Results.NotFound(new { message = "User not found" });
            var resolution = await authz.ResolvePermissionsAsync(user, session.TenantId);
            session.RefreshToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48));
            session.RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14);
            db.AuditLogs.Add(IdentityAuditLog.Create(session.TenantId, "identity.refresh-token.rotated", session.Id.ToString(), user.Email, "Refresh token rotated."));
            await db.SaveChangesAsync();
            return Results.Ok(TokenFactory.CreateTokenResponse(user, resolution, session, cfg));
        });

        app.MapPost("/api/v1/auth/logout", async ([FromBody] LogoutRequest req, IdentityDbContext db) =>
        {
            var session = await db.Sessions.FirstOrDefaultAsync(x => x.RefreshToken == req.RefreshToken);
            if (session is null) return Results.NoContent();
            var user = await db.Users.FirstOrDefaultAsync(x => x.Id == session.UserId && x.TenantId == session.TenantId);
            db.AuditLogs.Add(IdentityAuditLog.Create(session.TenantId, "identity.sign-out.completed", session.Id.ToString(), user?.Email ?? "unknown", "Session terminated."));
            db.Sessions.Remove(session);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        app.MapGet("/api/v1/roles", () => Results.Ok(new[] { "Student", "Professor", "Principal", "DepartmentHead", "Admin", "FinanceStaff" }));
    }
}
