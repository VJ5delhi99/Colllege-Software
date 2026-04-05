using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using University360.BuildingBlocks;
using Xunit;

namespace Platform.Tests;

public sealed class SmokeTests
{
    [Fact]
    public async Task ObjectStorageSignedUrlContainsBucketAndExpiry()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Platform:ObjectStorage:Provider"] = "MinIO",
                ["Platform:ObjectStorage:PublicBaseUrl"] = "http://localhost:9000",
                ["Platform:ObjectStorage:SigningKey"] = "test-signing-key"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddObjectStorage(configuration);
        var provider = services.BuildServiceProvider();
        var storage = provider.GetRequiredService<IObjectStorageService>();

        var signedUrl = await storage.CreateUploadUrlAsync("test-bucket", "tenant/file.pdf", "application/pdf", TimeSpan.FromMinutes(5));

        signedUrl.Provider.Should().Be("MinIO");
        signedUrl.Bucket.Should().Be("test-bucket");
        signedUrl.Url.ToString().Should().Contain("test-bucket");
        signedUrl.Url.ToString().Should().Contain("signature=");
    }

    [Fact]
    public void ProductionSecretsValidationRequiresCriticalKeys()
    {
        var configuration = new ConfigurationBuilder().Build();
        var services = new ServiceCollection();
        var environment = new FakeHostEnvironment { EnvironmentName = "Production" };

        var action = () => services.AddProductionSecretsValidation(configuration, environment);

        action.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void ProductionSecretsValidationRejectsTestPaymentCredentials()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Platform:Jwt:SigningKey"] = "production-super-secret-key",
                ["Platform:ObjectStorage:SigningKey"] = "production-object-storage-key",
                ["Platform:Cors:AllowedOrigins:0"] = "https://admin.university360.edu",
                ["ConnectionStrings:sqlserver"] = "Server=tcp:prod.database.windows.net;Initial Catalog=university360;User Id=sa;Password=ComplexPassword123!;",
                ["Payments:Stripe:PublicKey"] = "pk_test_stripe",
                ["Payments:Stripe:SecretKey"] = "sk_test_stripe",
                ["Payments:Stripe:WebhookSecret"] = "development-webhook-secret"
            })
            .Build();
        var services = new ServiceCollection();
        var environment = new FakeHostEnvironment { EnvironmentName = "Production" };

        var action = () => services.AddProductionSecretsValidation(configuration, environment);

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*payment configuration*");
    }

    private sealed class FakeHostEnvironment : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public string EnvironmentName { get; set; } = string.Empty;
        public string ApplicationName { get; set; } = "Platform.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } =
            new Microsoft.Extensions.FileProviders.PhysicalFileProvider(AppContext.BaseDirectory);
    }
}
