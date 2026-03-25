namespace University360.BuildingBlocks;

public sealed class PlatformOptions
{
    public const string SectionName = "Platform";

    public JwtOptions Jwt { get; init; } = new();
    public TenantOptions Tenant { get; init; } = new();
    public CorsOptions Cors { get; init; } = new();
}

public sealed class JwtOptions
{
    public string Authority { get; init; } = "https://identity.university360.local";
    public string Audience { get; init; } = "university360-api";
}

public sealed class TenantOptions
{
    public string HeaderName { get; init; } = "X-Tenant-Id";
}

public sealed class CorsOptions
{
    public string[] AllowedOrigins { get; init; } = ["*"];
}
