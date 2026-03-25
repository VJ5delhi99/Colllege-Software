using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<FinanceDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await SeedFinanceDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "finance-service", gateways = new[] { "Razorpay", "Stripe", "PayPal" } }));

app.MapPost("/api/v1/payments", async ([FromBody] RecordPaymentRequest request, FinanceDbContext dbContext) =>
{
    var payment = new Payment
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
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

app.MapGet("/api/v1/payments", async (HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.Payments.Where(x => x.TenantId == httpContext.GetTenantId()).OrderByDescending(x => x.PaidAtUtc).ToListAsync());

app.MapGet("/api/v1/payments/{studentId:guid}", async (Guid studentId, HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.Payments.Where(x => x.TenantId == httpContext.GetTenantId() && x.StudentId == studentId).ToListAsync());

app.MapPost("/api/v1/payment-intents", ([FromBody] PaymentIntentRequest request) =>
    Results.Ok(new
    {
        provider = request.Provider,
        intentId = $"{request.Provider.ToLowerInvariant()}_{Guid.NewGuid():N}",
        amount = request.Amount,
        currency = request.Currency,
        checkoutUrl = $"https://payments.university360.local/{request.Provider.ToLowerInvariant()}/checkout"
    }));

app.MapGet("/api/v1/payments/summary", async (HttpContext httpContext, FinanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetTenantId();
    var payments = await dbContext.Payments.Where(x => x.TenantId == tenantId && x.Status == "Paid").ToListAsync();
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
            TenantId = "default",
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
            TenantId = "default",
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

public sealed record RecordPaymentRequest(string TenantId, Guid StudentId, decimal Amount, string Currency, string Provider, string Status);
public sealed record PaymentIntentRequest(Guid StudentId, decimal Amount, string Currency, string Provider);

public sealed class Payment
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Provider { get; set; } = "Stripe";
    public string Status { get; set; } = "Paid";
    public DateTimeOffset PaidAtUtc { get; set; }
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public sealed class FinanceDbContext(DbContextOptions<FinanceDbContext> options) : DbContext(options)
{
    public DbSet<Payment> Payments => Set<Payment>();
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
}
