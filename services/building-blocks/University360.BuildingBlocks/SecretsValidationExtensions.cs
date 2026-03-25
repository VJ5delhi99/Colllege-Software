using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace University360.BuildingBlocks;

public static class SecretsValidationExtensions
{
    public static void AddProductionSecretsValidation(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        if (!environment.IsProduction())
        {
            return;
        }

        var requiredKeys = new[]
        {
            "ConnectionStrings:mysql",
            "Platform:Jwt:SigningKey",
            "Platform:ObjectStorage:SigningKey"
        };

        foreach (var key in requiredKeys)
        {
            if (string.IsNullOrWhiteSpace(configuration[key]))
            {
                throw new InvalidOperationException($"Missing required production secret: {key}");
            }
        }
    }
}
