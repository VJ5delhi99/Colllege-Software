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
}
