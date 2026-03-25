using System.Net.Http.Json;

namespace AiAssistantService.Api.Integrations;

public sealed class CommunicationServiceClient(HttpClient httpClient)
{
    public async Task<IReadOnlyList<AnnouncementDto>> GetAnnouncementsAsync(CancellationToken cancellationToken)
    {
        return await httpClient.GetFromJsonAsync<List<AnnouncementDto>>("/api/v1/announcements", cancellationToken) ?? [];
    }

    public async Task CreateAnnouncementAsync(CreateAnnouncementPayload payload, CancellationToken cancellationToken)
    {
        using var response = await httpClient.PostAsJsonAsync("/api/v1/announcements", payload, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}

public sealed record AnnouncementDto(Guid Id, string Title, string Body, string Audience, DateTimeOffset PublishedAtUtc);

public sealed record CreateAnnouncementPayload(string Title, string Body, string Audience);
