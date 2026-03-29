using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace University360.BuildingBlocks;

public static class MigrationsExtensions
{
    public static async Task EnsureDatabaseReadyAsync<TDbContext>(this WebApplication app)
        where TDbContext : DbContext
    {
        using var scope = app.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<TDbContext>>();

        for (var attempt = 1; attempt <= 12; attempt++)
        {
            try
            {
                if (dbContext.Database.IsRelational())
                {
                    var migrations = dbContext.Database.GetMigrations();
                    if (migrations.Any())
                    {
                        await dbContext.Database.MigrateAsync();
                    }
                    else
                    {
                        await EnsureSchemaObjectsExistAsync(dbContext);
                    }

                    return;
                }

                await dbContext.Database.EnsureCreatedAsync();
                return;
            }
            catch (Exception exception) when (attempt < 12)
            {
                logger.LogWarning(exception, "Database startup failed for {ContextName} on attempt {Attempt}. Retrying.", typeof(TDbContext).Name, attempt);
                await Task.Delay(TimeSpan.FromSeconds(5));
            }
        }

        if (dbContext.Database.IsRelational())
        {
            var migrations = dbContext.Database.GetMigrations();
            if (migrations.Any())
            {
                await dbContext.Database.MigrateAsync();
                return;
            }
        }

        await EnsureSchemaObjectsExistAsync(dbContext);
    }

    private static async Task EnsureSchemaObjectsExistAsync<TDbContext>(TDbContext dbContext)
        where TDbContext : DbContext
    {
        var created = await dbContext.Database.EnsureCreatedAsync();
        if (created)
        {
            return;
        }

        if (!dbContext.Database.IsRelational())
        {
            return;
        }

        var databaseCreator = dbContext.GetService<IRelationalDatabaseCreator>();
        var createScript = databaseCreator.GenerateCreateScript();
        foreach (var statement in SplitStatements(createScript))
        {
            try
            {
                await dbContext.Database.ExecuteSqlRawAsync(statement);
            }
            catch (Exception exception) when (IsAlreadyExistsError(exception))
            {
                // Shared schemas can already contain some objects from a partially-completed
                // bootstrap pass or from another service. Ignore duplicate object creation and
                // continue applying the remaining statements for this DbContext.
            }
        }
    }

    private static IReadOnlyList<string> SplitStatements(string script)
    {
        return script
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(statement => statement.Trim())
            .Where(statement => !string.IsNullOrWhiteSpace(statement))
            .ToArray();
    }

    private static bool IsAlreadyExistsError(Exception exception)
    {
        var message = exception.Message;
        return message.Contains("already exists", StringComparison.OrdinalIgnoreCase)
            || message.Contains("already an object named", StringComparison.OrdinalIgnoreCase)
            || message.Contains("duplicate key name", StringComparison.OrdinalIgnoreCase)
            || message.Contains("duplicate column name", StringComparison.OrdinalIgnoreCase);
    }
}
