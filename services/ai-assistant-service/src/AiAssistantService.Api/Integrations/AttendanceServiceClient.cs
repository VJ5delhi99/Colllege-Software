using System.Net.Http.Json;

namespace AiAssistantService.Api.Integrations;

public sealed class AttendanceServiceClient(HttpClient httpClient)
{
    public async Task<AttendanceSummaryDto> GetAttendanceSummaryAsync(string userId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return new AttendanceSummaryDto(0, 0, 0, 0);
        }

        var summary = await httpClient.GetFromJsonAsync<StudentAttendanceSummaryDto>($"/api/v1/students/{parsedUserId}/summary", cancellationToken);
        return new AttendanceSummaryDto(summary?.Total ?? 0, summary?.Present ?? 0, summary?.Percentage ?? 0, summary?.PhysicsPercentage ?? 0);
    }
}

public sealed record StudentAttendanceSummaryDto(int Total, int Present, double Percentage, double PhysicsPercentage);

public sealed record AttendanceSummaryDto(int Total, int Present, double Percentage, double PhysicsPercentage);
