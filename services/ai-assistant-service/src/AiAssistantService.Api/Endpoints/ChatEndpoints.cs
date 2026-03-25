using AiAssistantService.Api.Application;

namespace AiAssistantService.Api.Endpoints;

public static class ChatEndpoints
{
    public static void MapChatEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/chat")
            .RequireRateLimiting("api")
            .WithTags("AI Assistant");

        group.MapPost("/", async (ChatRequest request, HttpContext httpContext, ChatService chatService, CancellationToken cancellationToken) =>
        {
            var context = httpContext.BuildAssistantContext(request.UserId);
            if (context is null)
            {
                return Results.Forbid();
            }

            try
            {
                var result = await chatService.ProcessAsync(request, context, cancellationToken);
                return Results.Ok(new ChatResponse(result.Reply, result.Intent.ToString(), result.Citations));
            }
            catch (UnauthorizedAccessException)
            {
                return Results.Forbid();
            }
        })
        .WithName("Chat");

        group.MapPost("/stream", StreamChatAsync)
            .Produces(StatusCodes.Status200OK, contentType: "text/event-stream")
            .WithName("StreamChat");
    }

    private static async Task StreamChatAsync(
        ChatRequest request,
        HttpContext httpContext,
        ChatService chatService,
        CancellationToken cancellationToken)
    {
        var context = httpContext.BuildAssistantContext(request.UserId);
        if (context is null)
        {
            httpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        httpContext.Response.Headers.ContentType = "text/event-stream";

        try
        {
            await foreach (var chunk in chatService.StreamAsync(request, context, cancellationToken))
            {
                await httpContext.Response.WriteAsync($"data: {chunk.Content}\n\n", cancellationToken);
                await httpContext.Response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (UnauthorizedAccessException)
        {
            httpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
        }
    }

    private static AssistantUserContext? BuildAssistantContext(this HttpContext httpContext, string requestedUserId)
    {
        var principal = httpContext.User;
        var environment = httpContext.RequestServices.GetRequiredService<IHostEnvironment>();
        var isAuthenticated = principal.Identity?.IsAuthenticated == true;
        if (!isAuthenticated && !environment.IsDevelopment())
        {
            return null;
        }

        var role = isAuthenticated
            ? principal.FindFirst("role")?.Value ?? principal.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Student"
            : httpContext.Request.Headers["X-Demo-Role"].FirstOrDefault() ?? "Student";
        var subject = isAuthenticated
            ? principal.FindFirst("sub")?.Value ?? principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? requestedUserId
            : requestedUserId;
        var tenantId = principal.FindFirst("tenant_id")?.Value
            ?? httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault()
            ?? "default";

        var elevatedRole = role is "Admin" or "Principal" or "DepartmentHead";
        if (!elevatedRole && !string.Equals(subject, requestedUserId, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return new AssistantUserContext(subject, role, tenantId);
    }
}
