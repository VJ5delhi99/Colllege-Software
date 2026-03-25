using AiAssistantService.Api.AI;
using AiAssistantService.Api.Application;
using AiAssistantService.Api.Integrations;
using AiAssistantService.Api.VectorStore;

namespace AiAssistantService.Api.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddAiAssistant(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ChatService>();
        services.AddScoped<IntentResolver>();
        services.AddSingleton<SemanticKernelService>();
        services.AddScoped<KnowledgeIndexService>();
        services.AddHostedService<KnowledgeSeedWorker>();

        services.AddHttpClient<AttendanceServiceClient>(client =>
        {
            client.BaseAddress = new Uri(configuration["DownstreamServices:Attendance"] ?? "http://attendance-service");
        });

        services.AddHttpClient<AcademicServiceClient>(client =>
        {
            client.BaseAddress = new Uri(configuration["DownstreamServices:Academic"] ?? "http://academic-service");
        });

        services.AddHttpClient<ResultsServiceClient>(client =>
        {
            client.BaseAddress = new Uri(configuration["DownstreamServices:Results"] ?? "http://exam-service");
        });

        services.AddHttpClient<CommunicationServiceClient>(client =>
        {
            client.BaseAddress = new Uri(configuration["DownstreamServices:Communication"] ?? "http://communication-service");
        });

        return services;
    }
}
