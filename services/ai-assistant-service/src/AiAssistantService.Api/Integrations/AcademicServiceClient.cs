using System.Net.Http.Json;

namespace AiAssistantService.Api.Integrations;

public sealed class AcademicServiceClient(HttpClient httpClient)
{
    public async Task<IReadOnlyList<CourseDto>> GetCoursesAsync(CancellationToken cancellationToken)
    {
        return await httpClient.GetFromJsonAsync<List<CourseDto>>("/api/v1/courses", cancellationToken) ?? [];
    }
}

public sealed record CourseDto(Guid Id, string CourseCode, string Title, int Credits, string SemesterCode, Guid FacultyId);
