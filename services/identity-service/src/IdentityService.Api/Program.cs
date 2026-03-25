using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<IdentityDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await SeedIdentityDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "identity-service", status = "ready" }));

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
        MfaEnabled = request.MfaEnabled
    };

    dbContext.Users.Add(user);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/users/{user.Id}", user);
}).RequireRateLimiting("api");

app.MapGet("/api/v1/users", async (HttpContext httpContext, IdentityDbContext dbContext) =>
    await dbContext.Users.Where(x => x.TenantId == httpContext.GetTenantId()).OrderBy(x => x.FullName).ToListAsync());

app.MapGet("/api/v1/users/{id:guid}", async (Guid id, HttpContext httpContext, IdentityDbContext dbContext) =>
{
    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.TenantId == httpContext.GetTenantId() && x.Id == id);
    return user is null ? Results.NotFound() : Results.Ok(user);
});

app.MapPost("/api/v1/auth/token", async ([FromBody] TokenRequest request, IdentityDbContext dbContext, IConfiguration configuration) =>
{
    var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == request.Email && x.TenantId == request.TenantId);
    if (user is null)
    {
        return Results.NotFound(new { message = "User not found" });
    }

    var key = configuration["Platform:Jwt:SigningKey"] ?? "development-signing-key-please-change";
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role),
        new Claim("role", user.Role),
        new Claim("tenant_id", user.TenantId)
    };

    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
        issuer: configuration["Platform:Jwt:Authority"] ?? "https://identity.university360.local",
        audience: configuration["Platform:Jwt:Audience"] ?? "university360-api",
        claims: claims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: credentials);

    return Results.Ok(new
    {
        accessToken = new JwtSecurityTokenHandler().WriteToken(token),
        user = new { user.Id, user.FullName, user.Email, user.Role, user.TenantId }
    });
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
    await dbContext.Database.EnsureCreatedAsync();

    if (await dbContext.Users.AnyAsync())
    {
        return;
    }

    dbContext.Users.AddRange(
    [
        new PlatformUser { Id = KnownUsers.StudentId, TenantId = "default", Email = "student@university360.edu", FullName = "Aarav Sharma", Role = "Student", PasswordlessEnabled = true, MfaEnabled = false },
        new PlatformUser { Id = KnownUsers.ProfessorId, TenantId = "default", Email = "professor@university360.edu", FullName = "Dr. Meera Iyer", Role = "Professor", PasswordlessEnabled = true, MfaEnabled = true },
        new PlatformUser { Id = KnownUsers.AdminId, TenantId = "default", Email = "principal@university360.edu", FullName = "Prof. Kavita Menon", Role = "Principal", PasswordlessEnabled = true, MfaEnabled = true }
    ]);

    await dbContext.SaveChangesAsync();
}

public sealed record RegisterUserRequest(string TenantId, string Email, string FullName, string Role, bool PasswordlessEnabled, bool MfaEnabled);
public sealed record TokenRequest(string Email, string TenantId = "default");

public sealed class PlatformUser
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool PasswordlessEnabled { get; set; }
    public bool MfaEnabled { get; set; }
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<PlatformUser> Users => Set<PlatformUser>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
    public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999");
}
