using AiAssistantService.Api.AI;

namespace AiAssistantService.Api.Application;

public sealed class IntentResolver(SemanticKernelService semanticKernelService)
{
    public async Task<ResolvedIntent> ResolveAsync(string message, string role, CancellationToken cancellationToken)
    {
        var normalized = message.ToLowerInvariant();

        if (normalized.Contains("attendance"))
        {
            return new ResolvedIntent(ChatIntent.Attendance, "Keyword match on attendance", false);
        }

        if (normalized.Contains("result") || normalized.Contains("gpa") || normalized.Contains("grade"))
        {
            return new ResolvedIntent(ChatIntent.Results, "Keyword match on result/grade", false);
        }

        if (normalized.Contains("class") || normalized.Contains("schedule"))
        {
            return new ResolvedIntent(ChatIntent.Schedule, "Keyword match on schedule", false);
        }

        if (normalized.Contains("announcement") || normalized.Contains("blog"))
        {
            return normalized.Contains("post") || normalized.Contains("publish")
                ? new ResolvedIntent(ChatIntent.PostAnnouncement, "Administrative announcement intent", false)
                : new ResolvedIntent(ChatIntent.Announcements, "Keyword match on announcement", false);
        }

        if (normalized.Contains("assignment"))
        {
            return new ResolvedIntent(ChatIntent.UploadAssignment, "Professor workflow intent", false);
        }

        if (normalized.Contains("analytics") || normalized.Contains("performance"))
        {
            return new ResolvedIntent(ChatIntent.Analytics, "Analytics request", false);
        }

        if (normalized.Contains("policy") || normalized.Contains("rule") || normalized.Contains("handbook") || normalized.Contains("faq"))
        {
            return new ResolvedIntent(ChatIntent.Knowledge, "Knowledge base lookup", true);
        }

        var semanticIntent = await semanticKernelService.ResolveIntentAsync(message, role, cancellationToken);
        return semanticIntent ?? new ResolvedIntent(ChatIntent.Unknown, "Fallback to unknown", true);
    }
}
