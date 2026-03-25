using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<AuthorizationDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<AuthorizationDbContext>();
await SeedAuthorizationDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "authorization-service", status = "ready" }));

app.MapGet("/api/v1/permissions", async (HttpContext httpContext, AuthorizationDbContext dbContext) =>
    await dbContext.Permissions.Where(x => x.TenantId == httpContext.GetTenantId()).OrderBy(x => x.Name).ToListAsync())
    .RequirePermissions("rbac.manage");

app.MapGet("/api/v1/roles", async (HttpContext httpContext, AuthorizationDbContext dbContext) =>
    await dbContext.Roles.Where(x => x.TenantId == httpContext.GetTenantId()).OrderBy(x => x.Name).ToListAsync())
    .RequirePermissions("rbac.manage");

app.MapPost("/api/v1/roles", async ([FromBody] CreateRoleRequest request, AuthorizationDbContext dbContext) =>
{
    var role = new RoleDefinition
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        Name = request.Name,
        Description = request.Description
    };

    dbContext.Roles.Add(role);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/roles/{role.Id}", role);
}).RequirePermissions("rbac.manage");

app.MapPut("/api/v1/roles/{roleId:guid}/permissions", async (Guid roleId, [FromBody] UpdateRolePermissionsRequest request, AuthorizationDbContext dbContext) =>
{
    var role = await dbContext.Roles.FirstOrDefaultAsync(x => x.Id == roleId && x.TenantId == request.TenantId);
    if (role is null)
    {
        return Results.NotFound();
    }

    var existing = await dbContext.RolePermissions.Where(x => x.RoleId == roleId).ToListAsync();
    dbContext.RolePermissions.RemoveRange(existing);
    var permissions = await dbContext.Permissions.Where(x => x.TenantId == request.TenantId && request.PermissionNames.Contains(x.Name)).ToListAsync();
    dbContext.RolePermissions.AddRange(permissions.Select(permission => new RolePermission
    {
        Id = Guid.NewGuid(),
        RoleId = roleId,
        PermissionId = permission.Id
    }));

    await dbContext.SaveChangesAsync();
    return Results.NoContent();
}).RequirePermissions("rbac.manage");

app.MapPost("/api/v1/user-assignments", async ([FromBody] AssignUserRoleRequest request, AuthorizationDbContext dbContext) =>
{
    var assignment = new UserRoleAssignment
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        UserId = request.UserId,
        RoleName = request.RoleName
    };

    dbContext.UserRoleAssignments.Add(assignment);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/user-assignments/{assignment.Id}", assignment);
}).RequirePermissions("rbac.manage");

app.MapGet("/api/v1/policy-mappings", async (HttpContext httpContext, AuthorizationDbContext dbContext) =>
    await dbContext.PolicyMappings.Where(x => x.TenantId == httpContext.GetTenantId()).OrderBy(x => x.RoutePattern).ToListAsync())
    .RequirePermissions("rbac.manage");

app.MapPost("/api/v1/policy-mappings", async ([FromBody] PolicyMappingRequest request, AuthorizationDbContext dbContext) =>
{
    var mapping = new PolicyMapping
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        RoutePattern = request.RoutePattern,
        HttpMethod = request.HttpMethod,
        RequiredPermission = request.RequiredPermission
    };

    dbContext.PolicyMappings.Add(mapping);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/policy-mappings/{mapping.Id}", mapping);
}).RequirePermissions("rbac.manage");

app.MapGet("/internal/users/{userId:guid}/permissions", async (Guid userId, string role, string tenantId, AuthorizationDbContext dbContext) =>
{
    var assignedRoles = await dbContext.UserRoleAssignments
        .Where(x => x.UserId == userId && x.TenantId == tenantId)
        .Select(x => x.RoleName)
        .ToListAsync();

    if (!string.IsNullOrWhiteSpace(role) && !assignedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
    {
        assignedRoles.Add(role);
    }

    var permissions = await dbContext.RolePermissions
        .Join(dbContext.Roles, rolePermission => rolePermission.RoleId, roleDefinition => roleDefinition.Id, (rolePermission, roleDefinition) => new { rolePermission, roleDefinition })
        .Join(dbContext.Permissions, joined => joined.rolePermission.PermissionId, permission => permission.Id, (joined, permission) => new { joined.roleDefinition, permission })
        .Where(x => x.roleDefinition.TenantId == tenantId && assignedRoles.Contains(x.roleDefinition.Name))
        .Select(x => x.permission.Name)
        .Distinct()
        .OrderBy(x => x)
        .ToListAsync();

    return Results.Ok(new PermissionResolutionResponse(tenantId, userId, assignedRoles.Distinct(StringComparer.OrdinalIgnoreCase).ToArray(), permissions.ToArray()));
});

app.Run();

static async Task SeedAuthorizationDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AuthorizationDbContext>();

    if (await dbContext.Permissions.AnyAsync())
    {
        return;
    }

    var tenantId = "default";
    var permissions = new[]
    {
        "attendance.view", "attendance.mark", "results.publish", "results.view", "finance.manage",
        "announcements.create", "analytics.view", "rbac.manage", "files.upload", "payments.refund"
    }
    .Select(name => new PermissionDefinition
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        Name = name,
        Description = $"{name} permission"
    })
    .ToArray();

    var roles = new[]
    {
        new RoleDefinition { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Student", Description = "Student access" },
        new RoleDefinition { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Professor", Description = "Professor access" },
        new RoleDefinition { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Principal", Description = "Principal access" },
        new RoleDefinition { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Admin", Description = "Tenant administration" },
        new RoleDefinition { Id = Guid.NewGuid(), TenantId = tenantId, Name = "FinanceStaff", Description = "Finance operations" }
    };

    dbContext.Permissions.AddRange(permissions);
    dbContext.Roles.AddRange(roles);
    await dbContext.SaveChangesAsync();

    var permissionLookup = permissions.ToDictionary(x => x.Name, StringComparer.OrdinalIgnoreCase);
    dbContext.RolePermissions.AddRange(
    [
        .. Link("Student", "attendance.view", "results.view"),
        .. Link("Professor", "attendance.view", "attendance.mark", "announcements.create", "files.upload"),
        .. Link("Principal", "attendance.view", "results.view", "results.publish", "announcements.create", "analytics.view"),
        .. Link("Admin", "rbac.manage", "analytics.view", "announcements.create", "finance.manage"),
        .. Link("FinanceStaff", "finance.manage", "payments.refund")
    ]);

    dbContext.UserRoleAssignments.AddRange(
    [
        new UserRoleAssignment { Id = Guid.NewGuid(), TenantId = tenantId, UserId = KnownUsers.StudentId, RoleName = "Student" },
        new UserRoleAssignment { Id = Guid.NewGuid(), TenantId = tenantId, UserId = KnownUsers.ProfessorId, RoleName = "Professor" },
        new UserRoleAssignment { Id = Guid.NewGuid(), TenantId = tenantId, UserId = KnownUsers.AdminId, RoleName = "Principal" }
    ]);

    dbContext.PolicyMappings.AddRange(
    [
        new PolicyMapping { Id = Guid.NewGuid(), TenantId = tenantId, RoutePattern = "/api/v1/sessions", HttpMethod = "POST", RequiredPermission = "attendance.mark" },
        new PolicyMapping { Id = Guid.NewGuid(), TenantId = tenantId, RoutePattern = "/api/v1/payment-refunds", HttpMethod = "POST", RequiredPermission = "payments.refund" }
    ]);

    await dbContext.SaveChangesAsync();
    return;

    IEnumerable<RolePermission> Link(string roleName, params string[] permissionNames)
    {
        var roleId = roles.Single(x => x.Name == roleName).Id;
        return permissionNames.Select(permissionName => new RolePermission
        {
            Id = Guid.NewGuid(),
            RoleId = roleId,
            PermissionId = permissionLookup[permissionName].Id
        });
    }
}

public sealed record CreateRoleRequest(string TenantId, string Name, string Description);
public sealed record UpdateRolePermissionsRequest(string TenantId, string[] PermissionNames);
public sealed record AssignUserRoleRequest(string TenantId, Guid UserId, string RoleName);
public sealed record PolicyMappingRequest(string TenantId, string RoutePattern, string HttpMethod, string RequiredPermission);
public sealed record PermissionResolutionResponse(string TenantId, Guid UserId, string[] Roles, string[] Permissions);

public sealed class PermissionDefinition
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public sealed class RoleDefinition
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public sealed class RolePermission
{
    public Guid Id { get; set; }
    public Guid RoleId { get; set; }
    public Guid PermissionId { get; set; }
}

public sealed class UserRoleAssignment
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid UserId { get; set; }
    public string RoleName { get; set; } = string.Empty;
}

public sealed class PolicyMapping
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string RoutePattern { get; set; } = string.Empty;
    public string HttpMethod { get; set; } = string.Empty;
    public string RequiredPermission { get; set; } = string.Empty;
}

public sealed class AuthorizationDbContext(DbContextOptions<AuthorizationDbContext> options) : DbContext(options)
{
    public DbSet<PermissionDefinition> Permissions => Set<PermissionDefinition>();
    public DbSet<RoleDefinition> Roles => Set<RoleDefinition>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserRoleAssignment> UserRoleAssignments => Set<UserRoleAssignment>();
    public DbSet<PolicyMapping> PolicyMappings => Set<PolicyMapping>();
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
    public static readonly Guid ProfessorId = Guid.Parse("00000000-0000-0000-0000-000000000456");
    public static readonly Guid AdminId = Guid.Parse("00000000-0000-0000-0000-000000000999");
}
