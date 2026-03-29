using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using IdentityService.Api.Domain;
using Microsoft.IdentityModel.Tokens;

namespace IdentityService.Api.Application;

public static class PasswordUtility
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 120_000;

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool VerifyPassword(string storedHash, string password)
    {
        var parts = storedHash.Split('.', 3, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations))
        {
            return false;
        }

        var salt = Convert.FromBase64String(parts[1]);
        var expectedHash = Convert.FromBase64String(parts[2]);
        var actualHash = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expectedHash.Length);
        return CryptographicOperations.FixedTimeEquals(expectedHash, actualHash);
    }
}

public static class TotpUtility
{
    public static string GenerateSecret()
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var bytes = RandomNumberGenerator.GetBytes(20);
        var chars = new char[32];
        for (var i = 0; i < chars.Length; i++) chars[i] = alphabet[bytes[i % bytes.Length] % alphabet.Length];
        return new string(chars);
    }

    public static string GetProvisioningUri(string email, string secret) => $"otpauth://totp/University360:{Uri.EscapeDataString(email)}?secret={secret}&issuer=University360";
    public static bool IsValidCode(string secret, string? code) => !string.IsNullOrWhiteSpace(secret) && !string.IsNullOrWhiteSpace(code) && Enumerable.Range(-1, 3).Any(offset => string.Equals(ComputeCode(secret, DateTimeOffset.UtcNow.AddSeconds(offset * 30)), code, StringComparison.Ordinal));

    private static string ComputeCode(string secret, DateTimeOffset timestamp)
    {
        var counter = BitConverter.GetBytes(IPAddress.HostToNetworkOrder(timestamp.ToUnixTimeSeconds() / 30));
        using var hmac = new HMACSHA1(Encoding.ASCII.GetBytes(secret));
        var hash = hmac.ComputeHash(counter);
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24) | ((hash[offset + 1] & 0xFF) << 16) | ((hash[offset + 2] & 0xFF) << 8) | (hash[offset + 3] & 0xFF);
        return (binary % 1_000_000).ToString("D6");
    }
}

public static class IdentitySessionFactory
{
    public static AuthSession CreateSession(PlatformUser user) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = user.TenantId,
        UserId = user.Id,
        RefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)),
        RefreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(14),
        CreatedAtUtc = DateTimeOffset.UtcNow
    };

    public static string GenerateOneTimeCode() => RandomNumberGenerator.GetInt32(100000, 999999).ToString();
}

public static class TokenFactory
{
    public static TokenResponse CreateTokenResponse(PlatformUser user, PermissionResolution resolution, AuthSession session, IConfiguration cfg) => new(CreateJwt(user, resolution, session, cfg), session.RefreshToken, user.Id, user.FullName, user.Email, user.Role, user.TenantId, resolution.Permissions);

    public static object CreateOAuthTokenResponse(PlatformUser user, PermissionResolution resolution, AuthSession session, IConfiguration cfg)
    {
        var accessToken = CreateJwt(user, resolution, session, cfg);
        return new { token_type = "Bearer", access_token = accessToken, refresh_token = session.RefreshToken, expires_in = 1800, id_token = accessToken, scope = "openid profile email offline_access" };
    }

    private static string CreateJwt(PlatformUser user, PermissionResolution resolution, AuthSession session, IConfiguration cfg)
    {
        var key = cfg["Platform:Jwt:SigningKey"] ?? "development-signing-key-please-change";
        var claims = new List<Claim> { new(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Email, user.Email), new(ClaimTypes.Role, user.Role), new("role", user.Role), new("tenant_id", user.TenantId), new("session_id", session.Id.ToString()) };
        claims.AddRange(resolution.Permissions.Select(p => new Claim("permission", p)));
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(cfg["Platform:Jwt:Authority"] ?? "https://identity.university360.local", cfg["Platform:Jwt:Audience"] ?? "university360-api", claims, expires: DateTime.UtcNow.AddMinutes(30), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public static class UserMapper
{
    public static UserResponse ToUserResponse(PlatformUser user) => new(user.Id, user.TenantId, user.Email, user.FullName, user.Role, user.PasswordlessEnabled, user.MfaEnabled, user.EmailVerified);
}
