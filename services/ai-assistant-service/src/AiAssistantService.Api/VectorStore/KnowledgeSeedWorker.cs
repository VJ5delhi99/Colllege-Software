using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiAssistantService.Api.VectorStore;

public sealed class KnowledgeSeedWorker(IServiceScopeFactory scopeFactory, ILogger<KnowledgeSeedWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
            if (await dbContext.KnowledgeDocuments.AnyAsync(stoppingToken))
            {
                return;
            }

            var knowledgeIndexService = scope.ServiceProvider.GetRequiredService<KnowledgeIndexService>();
            await knowledgeIndexService.SeedAsync(
            [
                new KnowledgeDocument
                {
                    Id = Guid.NewGuid(),
                    TenantId = "default",
                    Source = "Student Handbook",
                    Title = "Attendance Requirement",
                    Content = "Students must maintain at least 75% attendance in each course to be eligible for final examinations.",
                    ExternalId = "handbook-attendance"
                },
                new KnowledgeDocument
                {
                    Id = Guid.NewGuid(),
                    TenantId = "default",
                    Source = "Exam Policy",
                    Title = "Exam Rules",
                    Content = "Students must present ID cards during exams, arrive 15 minutes early, and avoid prohibited electronic devices.",
                    ExternalId = "exam-rules"
                }
            ], stoppingToken);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Knowledge seeding failed during startup");
        }
    }
}
