using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Builder;
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
                        await dbContext.Database.EnsureCreatedAsync();
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

        await dbContext.Database.EnsureCreatedAsync();
    }
}
