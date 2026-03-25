using System.Net.Http.Json;

namespace AiAssistantService.Api.Integrations;

public sealed class ResultsServiceClient(HttpClient httpClient)
{
    public async Task<IReadOnlyList<ResultDto>> GetStudentResultsAsync(string userId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return [];
        }

        return await httpClient.GetFromJsonAsync<List<ResultDto>>($"/api/v1/results/{parsedUserId}", cancellationToken) ?? [];
    }
}

public sealed record ResultDto(Guid Id, Guid StudentId, string SemesterCode, decimal Gpa, bool Published, DateTimeOffset? PublishedAtUtc);
