namespace AiAssistantService.Api;

public sealed record ChatRequest(string Message, string UserId);

public sealed record ChatResponse(string Reply, string Intent, IReadOnlyList<string> Citations);

public sealed record StreamingChatChunk(string Type, string Content);

public enum ChatIntent
{
    Unknown = 0,
    Attendance = 1,
    Results = 2,
    Schedule = 3,
    Announcements = 4,
    Analytics = 5,
    PostAnnouncement = 6,
    UploadAssignment = 7,
    Knowledge = 8
}

public sealed record ResolvedIntent(ChatIntent Intent, string Reasoning, bool RequiresKnowledgeLookup);

public sealed record ChatExecutionResult(string Reply, ChatIntent Intent, IReadOnlyList<string> Citations);

public sealed record KnowledgeSnippet(string Source, string Title, string Content);

public sealed record AssistantUserContext(string UserId, string Role, string TenantId);
