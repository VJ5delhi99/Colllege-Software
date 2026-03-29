using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Api.Application;

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
public sealed record UserResponse(Guid Id, string TenantId, string Email, string FullName, string Role, bool PasswordlessEnabled, bool MfaEnabled, bool EmailVerified);
public sealed record PasswordResetRequest(string Email, string TenantId = "default");
public sealed record PasswordResetConfirmRequest(string Email, string Code, string NewPassword, string TenantId = "default");
public sealed record EmailVerificationSendRequest(string Email, string TenantId = "default");
public sealed record EmailVerificationConfirmRequest(string Email, string Code, string TenantId = "default");
