using System.Text;
using Microsoft.SemanticKernel;

namespace AiAssistantService.Api.AI;

public sealed class SemanticKernelService
{
    private readonly Kernel _kernel;
    private readonly string _intentPromptTemplate;
    private readonly string _knowledgePromptTemplate;
    private readonly bool _hasAiProvider;

    public SemanticKernelService(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var builder = Kernel.CreateBuilder();

        var endpoint = configuration["Ai:AzureOpenAI:Endpoint"];
        var apiKey = configuration["Ai:OpenAI:ApiKey"] ?? configuration["Ai:AzureOpenAI:ApiKey"];
        var model = configuration["Ai:OpenAI:ChatModel"] ?? "gpt-4o-mini";

        if (!string.IsNullOrWhiteSpace(endpoint) && !string.IsNullOrWhiteSpace(apiKey))
        {
            builder.AddAzureOpenAIChatCompletion(
                deploymentName: configuration["Ai:AzureOpenAI:Deployment"] ?? model,
                endpoint: endpoint,
                apiKey: apiKey);
            _hasAiProvider = true;
        }
        else if (!string.IsNullOrWhiteSpace(apiKey))
        {
            builder.AddOpenAIChatCompletion(modelId: model, apiKey: apiKey);
            _hasAiProvider = true;
        }

        _kernel = builder.Build();

        var templateRoot = Path.Combine(environment.ContentRootPath, "AI", "PromptTemplates");
        _intentPromptTemplate = File.ReadAllText(Path.Combine(templateRoot, "intent-resolver.txt"));
        _knowledgePromptTemplate = File.ReadAllText(Path.Combine(templateRoot, "knowledge-answer.txt"));
    }

    public async Task<ResolvedIntent?> ResolveIntentAsync(string message, string role, CancellationToken cancellationToken)
    {
        if (!_hasAiProvider)
        {
            return null;
        }

        try
        {
            var arguments = new KernelArguments
            {
                ["message"] = message,
                ["role"] = role
            };

            var response = await _kernel.InvokePromptAsync(_intentPromptTemplate, arguments, cancellationToken: cancellationToken);
            var raw = response.ToString().Trim().ToLowerInvariant();

            return raw switch
            {
                var value when value.Contains("attendance") => new ResolvedIntent(ChatIntent.Attendance, "Semantic Kernel resolution", false),
                var value when value.Contains("result") => new ResolvedIntent(ChatIntent.Results, "Semantic Kernel resolution", false),
                var value when value.Contains("schedule") => new ResolvedIntent(ChatIntent.Schedule, "Semantic Kernel resolution", false),
                var value when value.Contains("announcement") => new ResolvedIntent(ChatIntent.Announcements, "Semantic Kernel resolution", false),
                var value when value.Contains("analytics") => new ResolvedIntent(ChatIntent.Analytics, "Semantic Kernel resolution", false),
                var value when value.Contains("knowledge") => new ResolvedIntent(ChatIntent.Knowledge, "Semantic Kernel resolution", true),
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }

    public Task<string> GenerateKnowledgeReplyAsync(
        string question,
        string role,
        IReadOnlyList<KnowledgeSnippet> snippets,
        CancellationToken cancellationToken)
    {
        return GenerateReplyAsync(question, role, snippets, "Answer only from the retrieved university knowledge if it is relevant.", cancellationToken);
    }

    public Task<string> GenerateGeneralReplyAsync(
        string question,
        string role,
        IReadOnlyList<KnowledgeSnippet> snippets,
        CancellationToken cancellationToken)
    {
        return GenerateReplyAsync(question, role, snippets, "Answer clearly and stay within the user's university role permissions.", cancellationToken);
    }

    private async Task<string> GenerateReplyAsync(
        string question,
        string role,
        IReadOnlyList<KnowledgeSnippet> snippets,
        string systemInstruction,
        CancellationToken cancellationToken)
    {
        if (!_hasAiProvider)
        {
            return snippets.Count == 0
                ? "I could not find relevant university knowledge for that question."
                : snippets[0].Content;
        }

        var context = new StringBuilder();
        foreach (var snippet in snippets)
        {
            context.AppendLine($"Source: {snippet.Source}");
            context.AppendLine($"Title: {snippet.Title}");
            context.AppendLine(snippet.Content);
            context.AppendLine();
        }

        var arguments = new KernelArguments
        {
            ["question"] = question,
            ["role"] = role,
            ["knowledge"] = context.ToString(),
            ["instruction"] = systemInstruction
        };

        var response = await _kernel.InvokePromptAsync(_knowledgePromptTemplate, arguments, cancellationToken: cancellationToken);
        return response.ToString();
    }
}
