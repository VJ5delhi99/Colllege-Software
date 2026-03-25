using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace University360.BuildingBlocks;

public static class MigrationsExtensions
{
    public static async Task EnsureDatabaseReadyAsync<TDbContext>(this WebApplication app)
        where TDbContext : DbContext
    {
        using var scope = app.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TDbContext>();
        if (dbContext.Database.IsRelational())
        {
            await dbContext.Database.MigrateAsync();
            return;
        }

        await dbContext.Database.EnsureCreatedAsync();
    }
}
