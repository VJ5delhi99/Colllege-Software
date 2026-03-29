using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace University360.BuildingBlocks;

public static class TenantContextExtensions
{
    public static string GetValidatedTenantId(this HttpContext httpContext)
    {
        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            var tenantId = httpContext.User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrWhiteSpace(tenantId))
            {
                throw new UnauthorizedAccessException("Authenticated user is missing tenant context.");
            }

            return tenantId;
        }

        var headerTenantId = httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(headerTenantId))
        {
            return headerTenantId;
        }

        throw new BadHttpRequestException("Tenant context is required.");
    }

    public static void EnsureTenantAccess(this HttpContext httpContext, string requestedTenantId)
    {
        var validatedTenantId = httpContext.GetValidatedTenantId();
        if (!string.Equals(validatedTenantId, requestedTenantId, StringComparison.Ordinal))
        {
            throw new UnauthorizedAccessException("Tenant mismatch detected.");
        }
    }
}
