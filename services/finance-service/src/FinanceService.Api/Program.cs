using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddPlatformDefaults<FinanceDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await SeedFinanceDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "finance-service", gateways = new[] { "Razorpay", "Stripe", "PayPal" } }));

app.MapPost("/api/v1/payments", async ([FromBody] RecordPaymentRequest request, FinanceDbContext dbContext) =>
{
    var payment = new Payment
    {
        Id = Guid.NewGuid(),
        StudentId = request.StudentId,
        Amount = request.Amount,
        Currency = request.Currency,
        Provider = request.Provider,
        Status = request.Status,
        PaidAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.Payments.Add(payment);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/payments/{payment.Id}", payment);
}).RequireRateLimiting("api");

app.MapGet("/api/v1/payments", async (FinanceDbContext dbContext) =>
    await dbContext.Payments.OrderByDescending(x => x.PaidAtUtc).ToListAsync());

app.MapGet("/api/v1/payments/{studentId:guid}", async (Guid studentId, FinanceDbContext dbContext) =>
    await dbContext.Payments.Where(x => x.StudentId == studentId).ToListAsync());

app.MapGet("/api/v1/payments/summary", async (FinanceDbContext dbContext) =>
{
    var payments = await dbContext.Payments.Where(x => x.Status == "Paid").ToListAsync();
    return Results.Ok(new
    {
        totalCollected = payments.Sum(x => x.Amount),
        currency = payments.Select(x => x.Currency).FirstOrDefault() ?? "INR",
        totalTransactions = payments.Count
    });
});

app.Run();

static async Task SeedFinanceDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
    await dbContext.Database.EnsureCreatedAsync();

    if (await dbContext.Payments.AnyAsync())
    {
        return;
    }

    dbContext.Payments.AddRange(
    [
        new Payment
        {
            Id = Guid.NewGuid(),
            StudentId = KnownUsers.StudentId,
            Amount = 45000,
            Currency = "INR",
            Provider = "Razorpay",
            Status = "Paid",
            PaidAtUtc = DateTimeOffset.UtcNow.AddDays(-15)
        },
        new Payment
        {
            Id = Guid.NewGuid(),
            StudentId = KnownUsers.StudentId,
            Amount = 12000,
            Currency = "INR",
            Provider = "Stripe",
            Status = "Paid",
            PaidAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
        }
    ]);

    await dbContext.SaveChangesAsync();
}

public sealed record RecordPaymentRequest(Guid StudentId, decimal Amount, string Currency, string Provider, string Status);

public sealed class Payment
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Provider { get; set; } = "Stripe";
    public string Status { get; set; } = "Paid";
    public DateTimeOffset PaidAtUtc { get; set; }
}

public sealed class FinanceDbContext(DbContextOptions<FinanceDbContext> options) : DbContext(options)
{
    public DbSet<Payment> Payments => Set<Payment>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
}
