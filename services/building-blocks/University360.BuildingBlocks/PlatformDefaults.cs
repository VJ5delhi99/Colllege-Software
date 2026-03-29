using System.Reflection;
using MassTransit;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using StackExchange.Redis;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace University360.BuildingBlocks;

public static class PlatformDefaults
{
    public static void AddPlatformDefaults<TDbContext>(this WebApplicationBuilder builder)
        where TDbContext : DbContext
    {
        ConfigureLogging(builder);

        builder.Services.Configure<PlatformOptions>(builder.Configuration.GetSection(PlatformOptions.SectionName));
        builder.Services.AddProductionSecretsValidation(builder.Configuration, builder.Environment);
        builder.Services.AddProblemDetails();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("platform", policy =>
            {
                var allowedOrigins = builder.Configuration.GetSection("Platform:Cors:AllowedOrigins").Get<string[]>();
                if (allowedOrigins is null || allowedOrigins.Length == 0)
                {
                    if (builder.Environment.IsDevelopment())
                    {
                        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
                        return;
                    }

                    throw new InvalidOperationException("Platform:Cors:AllowedOrigins must be configured outside development.");
                }

                if (allowedOrigins.Contains("*"))
                {
                    if (!builder.Environment.IsDevelopment())
                    {
                        throw new InvalidOperationException("Wildcard CORS origins are not allowed outside development.");
                    }

                    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
                    return;
                }

                policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
            });
        });
        builder.Services.AddAuthorization();
        builder.Services.AddObjectStorage(builder.Configuration);
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = builder.Configuration["Platform:Jwt:Authority"];
                options.Audience = builder.Configuration["Platform:Jwt:Audience"];
                options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
                var signingKey = builder.Configuration["Platform:Jwt:SigningKey"];
                if (!string.IsNullOrWhiteSpace(signingKey))
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                        ValidateIssuer = true,
                        ValidIssuer = builder.Configuration["Platform:Jwt:Authority"],
                        ValidateAudience = true,
                        ValidAudience = builder.Configuration["Platform:Jwt:Audience"],
                        ClockSkew = TimeSpan.FromMinutes(1)
                    };
                }
            });

        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddFixedWindowLimiter("api", limiter =>
            {
                limiter.Window = TimeSpan.FromSeconds(10);
                limiter.PermitLimit = 100;
                limiter.QueueLimit = 0;
            });
        });

        builder.Services.AddHybridCache(options =>
        {
            options.DefaultEntryOptions = new HybridCacheEntryOptions
            {
                Expiration = TimeSpan.FromMinutes(10),
                LocalCacheExpiration = TimeSpan.FromMinutes(2)
            };
        });

        var databaseProvider = builder.Configuration["Platform:DatabaseProvider"]
            ?? (!string.IsNullOrWhiteSpace(builder.Configuration.GetConnectionString("sqlserver")) ? "SqlServer" : "MySql");
        var sqlServerConnection = builder.Configuration.GetConnectionString("sqlserver")
            ?? "Server=localhost,1433;Database=university360;User Id=sa;Password=Your_password123;TrustServerCertificate=True";
        var mysqlConnection = builder.Configuration.GetConnectionString("mysql")
            ?? "server=localhost;port=3306;database=university360;user=root;password=local";
        builder.Services.AddDbContext<TDbContext>(options =>
        {
            if (string.Equals(databaseProvider, "MySql", StringComparison.OrdinalIgnoreCase))
            {
                options.UseMySql(mysqlConnection, new MySqlServerVersion(new Version(8, 4, 0)));
                return;
            }

            options.UseSqlServer(sqlServerConnection);
        });

        var redisConnection = builder.Configuration.GetConnectionString("redis");
        if (!string.IsNullOrWhiteSpace(redisConnection))
        {
            builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConnection));
        }

        builder.Services.AddMassTransit(configurator =>
        {
            configurator.SetKebabCaseEndpointNameFormatter();
            configurator.UsingRabbitMq((context, cfg) =>
            {
                cfg.Host(builder.Configuration.GetConnectionString("rabbitmq") ?? "rabbitmq://localhost");
                cfg.ConfigureEndpoints(context);
            });
        });

        var serviceName = builder.Environment.ApplicationName;
        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService(serviceName, serviceVersion: Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "0.1.0"))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddSource(serviceName)
                .AddOtlpExporter())
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddRuntimeInstrumentation()
                .AddOtlpExporter());

        builder.Services.AddHealthChecks()
            .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy(), tags: ["live"])
            .AddCheck("startup", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy(), tags: ["ready"]);
    }

    public static void UsePlatformDefaults(this WebApplication app)
    {
        app.UseSerilogRequestLogging();
        app.UseExceptionHandler();
        app.UseCors("platform");
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains("live")
        });
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains("ready")
        });
        app.MapHealthChecks("/health");
    }

    private static void ConfigureLogging(WebApplicationBuilder builder)
    {
        Log.Logger = new LoggerConfiguration()
            .Enrich.FromLogContext()
            .Enrich.WithEnvironmentName()
            .WriteTo.Console()
            .CreateLogger();

        builder.Host.UseSerilog();
    }
}
