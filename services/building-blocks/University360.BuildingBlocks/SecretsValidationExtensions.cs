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
            "Platform:Jwt:SigningKey",
            "Platform:ObjectStorage:SigningKey",
            "Platform:Cors:AllowedOrigins:0"
        };

        foreach (var key in requiredKeys)
        {
            if (string.IsNullOrWhiteSpace(configuration[key]))
            {
                throw new InvalidOperationException($"Missing required production secret: {key}");
            }
        }

        var databaseProvider = configuration["Platform:DatabaseProvider"] ?? "SqlServer";
        var connectionKey = string.Equals(databaseProvider, "MySql", StringComparison.OrdinalIgnoreCase)
            ? "ConnectionStrings:mysql"
            : "ConnectionStrings:sqlserver";

        if (string.IsNullOrWhiteSpace(configuration[connectionKey]))
        {
            throw new InvalidOperationException($"Missing required production secret: {connectionKey}");
        }

        var jwtSigningKey = configuration["Platform:Jwt:SigningKey"];
        if (string.Equals(jwtSigningKey, "development-signing-key-please-change", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Production JWT signing key must not use the development default.");
        }

        var objectStorageSigningKey = configuration["Platform:ObjectStorage:SigningKey"];
        if (string.Equals(objectStorageSigningKey, "development-object-storage-signing-key", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Production object-storage signing key must not use the development default.");
        }

        ValidateConfiguredEmailDelivery(configuration);
        ValidateConfiguredPaymentProviders(configuration);
    }

    private static void ValidateConfiguredEmailDelivery(IConfiguration configuration)
    {
        var smtpHost = configuration["AuthDelivery:Email:SmtpHost"];
        if (string.IsNullOrWhiteSpace(smtpHost))
        {
            return;
        }

        var requiredEmailKeys = new[]
        {
            "AuthDelivery:Email:Username",
            "AuthDelivery:Email:Password",
            "AuthDelivery:Email:From"
        };

        foreach (var key in requiredEmailKeys)
        {
            if (string.IsNullOrWhiteSpace(configuration[key]))
            {
                throw new InvalidOperationException($"Missing required production secret: {key}");
            }
        }
    }

    private static void ValidateConfiguredPaymentProviders(IConfiguration configuration)
    {
        foreach (var providerName in new[] { "Razorpay", "Stripe", "PayPal" })
        {
            var publicKey = configuration[$"Payments:{providerName}:PublicKey"];
            var secretKey = configuration[$"Payments:{providerName}:SecretKey"];
            var webhookSecret = configuration[$"Payments:{providerName}:WebhookSecret"];

            if (string.IsNullOrWhiteSpace(publicKey) && string.IsNullOrWhiteSpace(secretKey) && string.IsNullOrWhiteSpace(webhookSecret))
            {
                continue;
            }

            if (IsDevelopmentPaymentValue(publicKey) || IsDevelopmentPaymentValue(secretKey) || IsDevelopmentPaymentValue(webhookSecret))
            {
                throw new InvalidOperationException($"Production payment configuration for {providerName} must not use development or test values.");
            }
        }
    }

    private static bool IsDevelopmentPaymentValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        return value.Contains("test", StringComparison.OrdinalIgnoreCase)
            || value.Contains("development", StringComparison.OrdinalIgnoreCase)
            || value.Equals("paypal-client-id", StringComparison.OrdinalIgnoreCase)
            || value.Equals("paypal-secret", StringComparison.OrdinalIgnoreCase);
    }
}
