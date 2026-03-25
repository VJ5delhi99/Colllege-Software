using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace University360.BuildingBlocks;

public static class RbacExtensions
{
    public static RouteHandlerBuilder RequireRoles(this RouteHandlerBuilder builder, params string[] roles)
    {
        return builder.AddEndpointFilter(async (context, next) =>
        {
            var httpContext = context.HttpContext;
            var environment = httpContext.RequestServices.GetRequiredService<IHostEnvironment>();
            var principal = httpContext.User;
            var role = principal.FindFirst("role")?.Value
                ?? principal.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
                ?? string.Empty;

            if (principal.Identity?.IsAuthenticated != true)
            {
                return Results.Unauthorized();
            }

            if (roles.Length > 0 && !roles.Contains(role, StringComparer.OrdinalIgnoreCase))
            {
                return Results.Forbid();
            }

            return await next(context);
        });
    }

    public static RouteHandlerBuilder RequirePermissions(this RouteHandlerBuilder builder, params string[] permissions)
    {
        return builder.AddEndpointFilter(async (context, next) =>
        {
            var principal = context.HttpContext.User;
            if (principal.Identity?.IsAuthenticated != true)
            {
                return Results.Unauthorized();
            }

            var grantedPermissions = principal.Claims
                .Where(claim => string.Equals(claim.Type, "permission", StringComparison.OrdinalIgnoreCase))
                .Select(claim => claim.Value)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (permissions.Any(permission => !grantedPermissions.Contains(permission)))
            {
                return Results.Forbid();
            }

            return await next(context);
        });
    }
}
