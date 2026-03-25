using Microsoft.EntityFrameworkCore;
using Qdrant.Client;

namespace AiAssistantService.Api.VectorStore;

public sealed class KnowledgeIndexService
{
    private readonly AiAssistantDbContext _dbContext;
    private readonly ILogger<KnowledgeIndexService> _logger;
    private readonly string _collectionName;
    private readonly QdrantClient? _qdrantClient;

    public KnowledgeIndexService(AiAssistantDbContext dbContext, ILogger<KnowledgeIndexService> logger, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _logger = logger;
        _collectionName = configuration["Ai:VectorStore:Collection"] ?? "university360-knowledge";
        _qdrantClient = CreateQdrantClient(configuration);
    }

    public async Task<IReadOnlyList<KnowledgeSnippet>> SearchAsync(string query, string tenantId, CancellationToken cancellationToken)
    {
        var localMatches = await _dbContext.KnowledgeDocuments
            .Where(x => x.TenantId == tenantId && (x.Content.Contains(query) || x.Title.Contains(query)))
            .OrderByDescending(x => x.IndexedAtUtc)
            .Take(3)
            .Select(x => new KnowledgeSnippet(x.Source, x.Title, x.Content))
            .ToListAsync(cancellationToken);

        if (localMatches.Count > 0)
        {
            return localMatches;
        }

        if (_qdrantClient is not null)
        {
            _logger.LogInformation("Qdrant client configured for collection {CollectionName}", _collectionName);
        }

        return [];
    }

    public async Task SeedAsync(IEnumerable<KnowledgeDocument> documents, CancellationToken cancellationToken)
    {
        foreach (var document in documents)
        {
            document.IndexedAtUtc = DateTimeOffset.UtcNow;
        }

        await _dbContext.KnowledgeDocuments.AddRangeAsync(documents, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static QdrantClient? CreateQdrantClient(IConfiguration configuration)
    {
        var endpoint = configuration["Ai:VectorStore:Endpoint"];
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            return null;
        }

        var uri = new Uri(endpoint);
        return new QdrantClient(uri.Host, uri.Port, https: uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase), apiKey: configuration["Ai:VectorStore:ApiKey"]);
    }
}
