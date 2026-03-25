using AiAssistantService.Api.Endpoints;
using AiAssistantService.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<AiAssistantDbContext>();
builder.Services.AddAiAssistant(builder.Configuration);

var app = builder.Build();
app.UsePlatformDefaults();
app.MapChatEndpoints();
await app.EnsureDatabaseReadyAsync<AiAssistantDbContext>();

app.MapGet("/", () => Results.Ok(new
{
    service = "ai-assistant-service",
    mode = "semantic-kernel-rag-enabled"
}));

app.Run();

public sealed class AiAssistantDbContext(DbContextOptions<AiAssistantDbContext> options) : DbContext(options)
{
    public DbSet<ConversationTurn> ConversationTurns => Set<ConversationTurn>();
    public DbSet<KnowledgeDocument> KnowledgeDocuments => Set<KnowledgeDocument>();
}

public sealed class ConversationTurn
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string UserMessage { get; set; } = string.Empty;
    public string AssistantReply { get; set; } = string.Empty;
    public string Intent { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class KnowledgeDocument
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public DateTimeOffset IndexedAtUtc { get; set; }
}
