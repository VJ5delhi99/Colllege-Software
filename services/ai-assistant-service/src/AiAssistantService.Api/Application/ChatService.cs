using AiAssistantService.Api.AI;
using AiAssistantService.Api.Integrations;
using AiAssistantService.Api.VectorStore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace AiAssistantService.Api.Application;

public sealed class ChatService(
    IntentResolver intentResolver,
    AttendanceServiceClient attendanceServiceClient,
    AcademicServiceClient academicServiceClient,
    ResultsServiceClient resultsServiceClient,
    CommunicationServiceClient communicationServiceClient,
    KnowledgeIndexService knowledgeIndexService,
    SemanticKernelService semanticKernelService,
    HybridCache cache,
    AiAssistantDbContext dbContext)
{
    public async Task<ChatExecutionResult> ProcessAsync(ChatRequest request, AssistantUserContext context, CancellationToken cancellationToken)
    {
        var cacheKey = $"assistant:{context.TenantId}:{context.Role}:{context.UserId}:{request.Message.Trim().ToLowerInvariant()}";
        return await cache.GetOrCreateAsync(cacheKey, async _ =>
        {
            var intent = await intentResolver.ResolveAsync(request.Message, context.Role, cancellationToken);
            EnforceRole(intent.Intent, context.Role);

            var result = intent.Intent switch
            {
                ChatIntent.Attendance => await HandleAttendanceAsync(context, cancellationToken),
                ChatIntent.Results => await HandleResultsAsync(context, cancellationToken),
                ChatIntent.Schedule => await HandleScheduleAsync(cancellationToken),
                ChatIntent.Announcements => await HandleAnnouncementsAsync(cancellationToken),
                ChatIntent.Analytics => await HandleAnalyticsAsync(context, cancellationToken),
                ChatIntent.PostAnnouncement => await HandlePostAnnouncementAsync(request, context, cancellationToken),
                ChatIntent.UploadAssignment => new ChatExecutionResult("Assignment upload is routed to the LMS service, which has not been scaffolded yet.", ChatIntent.UploadAssignment, []),
                ChatIntent.Knowledge => await HandleKnowledgeAsync(request, context, cancellationToken),
                _ => await HandleFallbackAsync(request, context, cancellationToken)
            };

            dbContext.ConversationTurns.Add(new ConversationTurn
            {
                Id = Guid.NewGuid(),
                TenantId = context.TenantId,
                UserId = context.UserId,
                Role = context.Role,
                UserMessage = request.Message,
                AssistantReply = result.Reply,
                Intent = result.Intent.ToString(),
                CreatedAtUtc = DateTimeOffset.UtcNow
            });

            await dbContext.SaveChangesAsync(cancellationToken);
            return result;
        }, cancellationToken: cancellationToken);
    }

    public async IAsyncEnumerable<StreamingChatChunk> StreamAsync(
        ChatRequest request,
        AssistantUserContext context,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var result = await ProcessAsync(request, context, cancellationToken);
        foreach (var token in result.Reply.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            yield return new StreamingChatChunk("token", $"{token} ");
            await Task.Delay(20, cancellationToken);
        }

        if (result.Citations.Count > 0)
        {
            yield return new StreamingChatChunk("citation", $"Sources: {string.Join(", ", result.Citations)}");
        }
    }

    private async Task<ChatExecutionResult> HandleAttendanceAsync(AssistantUserContext context, CancellationToken cancellationToken)
    {
        var attendance = await attendanceServiceClient.GetAttendanceSummaryAsync(context.UserId, cancellationToken);
        return new ChatExecutionResult(
            $"Your overall attendance is {attendance.Percentage}%. Physics attendance is {attendance.PhysicsPercentage}%, with {attendance.Present} attended sessions out of {attendance.Total}.",
            ChatIntent.Attendance,
            []);
    }

    private async Task<ChatExecutionResult> HandleResultsAsync(AssistantUserContext context, CancellationToken cancellationToken)
    {
        var results = await resultsServiceClient.GetStudentResultsAsync(context.UserId, cancellationToken);
        return new ChatExecutionResult(
            results.Count == 0
                ? "No published semester results were found for your account."
                : $"You have {results.Count} published result entries. Latest GPA: {results[0].Gpa}.",
            ChatIntent.Results,
            []);
    }

    private async Task<ChatExecutionResult> HandleScheduleAsync(CancellationToken cancellationToken)
    {
        var courses = await academicServiceClient.GetCoursesAsync(cancellationToken);
        var nextCourse = courses.FirstOrDefault();
        var reply = nextCourse is null
            ? "I could not find a scheduled course right now."
            : $"Your next scheduled class is {nextCourse.Title} ({nextCourse.CourseCode}) in semester {nextCourse.SemesterCode}.";

        return new ChatExecutionResult(reply, ChatIntent.Schedule, []);
    }

    private async Task<ChatExecutionResult> HandleAnnouncementsAsync(CancellationToken cancellationToken)
    {
        var announcements = await communicationServiceClient.GetAnnouncementsAsync(cancellationToken);
        var latest = announcements.FirstOrDefault();
        var reply = latest is null
            ? "There are no recent announcements."
            : $"Latest announcement: {latest.Title}. Audience: {latest.Audience}.";

        return new ChatExecutionResult(reply, ChatIntent.Announcements, []);
    }

    private async Task<ChatExecutionResult> HandleAnalyticsAsync(AssistantUserContext context, CancellationToken cancellationToken)
    {
        if (context.Role is not ("Principal" or "Admin" or "DepartmentHead"))
        {
            throw new UnauthorizedAccessException("Analytics access is restricted to elevated roles.");
        }

        var attendance = await attendanceServiceClient.GetAttendanceSummaryAsync(context.UserId, cancellationToken);
        var results = await resultsServiceClient.GetStudentResultsAsync(context.UserId, cancellationToken);
        var analyticsReply = $"Attendance trend snapshot: {attendance.Percentage}% attendance. Result entries: {results.Count}. For institution-wide analytics, connect AI Insights and ClickHouse.";
        return new ChatExecutionResult(analyticsReply, ChatIntent.Analytics, []);
    }

    private async Task<ChatExecutionResult> HandlePostAnnouncementAsync(ChatRequest request, AssistantUserContext context, CancellationToken cancellationToken)
    {
        if (context.Role is not ("Professor" or "Principal" or "Admin"))
        {
            throw new UnauthorizedAccessException("Announcement publishing requires professor or admin privileges.");
        }

        await communicationServiceClient.CreateAnnouncementAsync(new CreateAnnouncementPayload(
            Title: "AI Draft Announcement",
            Body: request.Message,
            Audience: context.Role is "Principal" ? "All" : "Students"), cancellationToken);

        return new ChatExecutionResult("Announcement draft submitted to the communication service.", ChatIntent.PostAnnouncement, []);
    }

    private async Task<ChatExecutionResult> HandleKnowledgeAsync(ChatRequest request, AssistantUserContext context, CancellationToken cancellationToken)
    {
        var snippets = await knowledgeIndexService.SearchAsync(request.Message, context.TenantId, cancellationToken);
        var reply = await semanticKernelService.GenerateKnowledgeReplyAsync(request.Message, context.Role, snippets, cancellationToken);
        var citations = snippets.Select(x => $"{x.Source}: {x.Title}").ToArray();
        return new ChatExecutionResult(reply, ChatIntent.Knowledge, citations);
    }

    private async Task<ChatExecutionResult> HandleFallbackAsync(ChatRequest request, AssistantUserContext context, CancellationToken cancellationToken)
    {
        var snippets = await knowledgeIndexService.SearchAsync(request.Message, context.TenantId, cancellationToken);
        var reply = await semanticKernelService.GenerateGeneralReplyAsync(request.Message, context.Role, snippets, cancellationToken);
        return new ChatExecutionResult(reply, ChatIntent.Unknown, snippets.Select(x => $"{x.Source}: {x.Title}").ToArray());
    }

    private static void EnforceRole(ChatIntent intent, string role)
    {
        if (intent is ChatIntent.Analytics && role is not ("Principal" or "Admin" or "DepartmentHead"))
        {
            throw new UnauthorizedAccessException("Insufficient permissions for analytics.");
        }

        if (intent is ChatIntent.PostAnnouncement && role is not ("Professor" or "Principal" or "Admin"))
        {
            throw new UnauthorizedAccessException("Insufficient permissions to publish announcements.");
        }
    }
}
