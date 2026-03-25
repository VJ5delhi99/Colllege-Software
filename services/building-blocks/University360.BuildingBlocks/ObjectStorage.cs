using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;

namespace University360.BuildingBlocks;

public static class ObjectStorageExtensions
{
    public static IServiceCollection AddObjectStorage(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ObjectStorageOptions>(configuration.GetSection(ObjectStorageOptions.SectionName));
        services.AddSingleton<IObjectStorageService, SignedUrlObjectStorageService>();
        return services;
    }
}

public interface IObjectStorageService
{
    ValueTask<SignedObjectUrl> CreateUploadUrlAsync(string bucket, string objectKey, string contentType, TimeSpan lifetime, CancellationToken cancellationToken = default);
    ValueTask<SignedObjectUrl> CreateDownloadUrlAsync(string bucket, string objectKey, TimeSpan lifetime, CancellationToken cancellationToken = default);
}

public sealed record SignedObjectUrl(string Provider, string Bucket, string ObjectKey, Uri Url, DateTimeOffset ExpiresAtUtc);

public sealed class ObjectStorageOptions
{
    public const string SectionName = "Platform:ObjectStorage";
    public string Provider { get; set; } = "MinIO";
    public string PublicBaseUrl { get; set; } = "http://localhost:9000";
    public string SigningKey { get; set; } = "development-object-storage-signing-key";
}

internal sealed class SignedUrlObjectStorageService(IOptions<ObjectStorageOptions> options) : IObjectStorageService
{
    private readonly ObjectStorageOptions _options = options.Value;

    public ValueTask<SignedObjectUrl> CreateUploadUrlAsync(string bucket, string objectKey, string contentType, TimeSpan lifetime, CancellationToken cancellationToken = default)
        => ValueTask.FromResult(CreateSignedUrl(bucket, objectKey, "upload", lifetime, contentType));

    public ValueTask<SignedObjectUrl> CreateDownloadUrlAsync(string bucket, string objectKey, TimeSpan lifetime, CancellationToken cancellationToken = default)
        => ValueTask.FromResult(CreateSignedUrl(bucket, objectKey, "download", lifetime, "application/octet-stream"));

    private SignedObjectUrl CreateSignedUrl(string bucket, string objectKey, string action, TimeSpan lifetime, string contentType)
    {
        var expiresAtUtc = DateTimeOffset.UtcNow.Add(lifetime);
        var payload = $"{action}:{bucket}:{objectKey}:{contentType}:{expiresAtUtc.ToUnixTimeSeconds()}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.SigningKey));
        var signature = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        var url = new Uri($"{_options.PublicBaseUrl.TrimEnd('/')}/{bucket}/{Uri.EscapeDataString(objectKey)}?action={action}&expires={expiresAtUtc.ToUnixTimeSeconds()}&signature={signature}");
        return new SignedObjectUrl(_options.Provider, bucket, objectKey, url, expiresAtUtc);
    }
}
