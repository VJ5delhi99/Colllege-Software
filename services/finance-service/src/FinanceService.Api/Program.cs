using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<FinanceDbContext>();
builder.Services.AddHostedService<PaymentReconciliationWorker>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<FinanceDbContext>();
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
        PaidAtUtc = DateTimeOffset.UtcNow,
        InvoiceNumber = request.InvoiceNumber
    };

    dbContext.Payments.Add(payment);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/payments/{payment.Id}", payment);
}).RequirePermissions("finance.manage");

app.MapGet("/api/v1/payments", async (HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.Payments.Where(x => x.TenantId == httpContext.GetTenantId()).OrderByDescending(x => x.PaidAtUtc).ToListAsync())
    .RequirePermissions("finance.manage");

app.MapGet("/api/v1/payments/{studentId:guid}", async (Guid studentId, HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.Payments.Where(x => x.TenantId == httpContext.GetTenantId() && x.StudentId == studentId).ToListAsync())
    .RequirePermissions("finance.manage");

app.MapPost("/api/v1/payment-sessions", async ([FromBody] PaymentSessionRequest request, FinanceDbContext dbContext) =>
{
    var session = new PaymentSession
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        StudentId = request.StudentId,
        Provider = request.Provider,
        Amount = request.Amount,
        Currency = request.Currency,
        InvoiceNumber = request.InvoiceNumber,
        ProviderReference = $"{request.Provider.ToLowerInvariant()}_{Guid.NewGuid():N}",
        Status = "Pending",
        CreatedAtUtc = DateTimeOffset.UtcNow
    };

    dbContext.PaymentSessions.Add(session);
    await dbContext.SaveChangesAsync();

    return Results.Ok(new
    {
        sessionId = session.Id,
        provider = session.Provider,
        providerReference = session.ProviderReference,
        checkoutUrl = $"https://payments.university360.local/{session.Provider.ToLowerInvariant()}/checkout/{session.ProviderReference}"
    });
}).RequirePermissions("finance.manage");

app.MapPost("/api/v1/payment-webhooks/{provider}", async (string provider, [FromBody] PaymentWebhookRequest request, FinanceDbContext dbContext, IConfiguration configuration) =>
{
    var expectedSecret = configuration[$"Payments:{provider}:WebhookSecret"] ?? "development-webhook-secret";
    if (!string.Equals(expectedSecret, request.Signature, StringComparison.Ordinal))
    {
        return Results.Unauthorized();
    }

    var session = await dbContext.PaymentSessions.FirstOrDefaultAsync(x => x.Provider == provider && x.ProviderReference == request.ProviderReference);
    if (session is null)
    {
        return Results.NotFound();
    }

    session.Status = request.Status;
    var payment = new Payment
    {
        Id = Guid.NewGuid(),
        TenantId = session.TenantId,
        StudentId = session.StudentId,
        Amount = session.Amount,
        Currency = session.Currency,
        Provider = session.Provider,
        Status = request.Status == "Paid" ? "Paid" : "Pending",
        PaidAtUtc = DateTimeOffset.UtcNow,
        InvoiceNumber = session.InvoiceNumber
    };

    dbContext.Payments.Add(payment);
    dbContext.WebhookReceipts.Add(new PaymentWebhookReceipt
    {
        Id = Guid.NewGuid(),
        Provider = provider,
        ProviderReference = request.ProviderReference,
        Signature = request.Signature,
        PayloadJson = request.PayloadJson,
        ReceivedAtUtc = DateTimeOffset.UtcNow
    });

    await dbContext.SaveChangesAsync();
    return Results.Accepted();
});

app.MapPost("/api/v1/payment-refunds", async ([FromBody] RefundRequest request, FinanceDbContext dbContext) =>
{
    var payment = await dbContext.Payments.FirstOrDefaultAsync(x => x.Id == request.PaymentId && x.TenantId == request.TenantId);
    if (payment is null)
    {
        return Results.NotFound();
    }

    payment.Status = "Refunded";
    dbContext.Refunds.Add(new PaymentRefund
    {
        Id = Guid.NewGuid(),
        TenantId = request.TenantId,
        PaymentId = request.PaymentId,
        Reason = request.Reason,
        Amount = request.Amount,
        RequestedAtUtc = DateTimeOffset.UtcNow
    });
    await dbContext.SaveChangesAsync();
    return Results.Accepted();
}).RequirePermissions("payments.refund");

app.MapGet("/api/v1/payments/summary", async (HttpContext httpContext, FinanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetTenantId();
    var payments = await dbContext.Payments.Where(x => x.TenantId == tenantId && x.Status == "Paid").ToListAsync();
    var pendingReconciliation = await dbContext.PaymentSessions.CountAsync(x => x.TenantId == tenantId && x.Status == "Pending");
    return Results.Ok(new
    {
        totalCollected = payments.Sum(x => x.Amount),
        currency = payments.Select(x => x.Currency).FirstOrDefault() ?? "INR",
        totalTransactions = payments.Count,
        pendingReconciliation
    });
}).RequirePermissions("finance.manage");

app.MapGet("/api/v1/reconciliation/runs", async (FinanceDbContext dbContext) =>
    await dbContext.ReconciliationRuns.OrderByDescending(x => x.ExecutedAtUtc).Take(20).ToListAsync())
    .RequirePermissions("finance.manage");

app.Run();

static async Task SeedFinanceDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();

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
            PaidAtUtc = DateTimeOffset.UtcNow.AddDays(-15),
            InvoiceNumber = "INV-2026-001"
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
            PaidAtUtc = DateTimeOffset.UtcNow.AddDays(-2),
            InvoiceNumber = "INV-2026-002"
        }
    ]);

    dbContext.PaymentSessions.Add(new PaymentSession
    {
        Id = Guid.NewGuid(),
        TenantId = "default",
        StudentId = KnownUsers.StudentId,
        Provider = "PayPal",
        Amount = 8000,
        Currency = "INR",
        InvoiceNumber = "INV-2026-003",
        ProviderReference = $"paypal_{Guid.NewGuid():N}",
        Status = "Pending",
        CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-2)
    });

    await dbContext.SaveChangesAsync();
}

public sealed record RecordPaymentRequest(string TenantId, Guid StudentId, decimal Amount, string Currency, string Provider, string Status, string InvoiceNumber);
public sealed record PaymentSessionRequest(string TenantId, Guid StudentId, decimal Amount, string Currency, string Provider, string InvoiceNumber);
public sealed record PaymentWebhookRequest(string ProviderReference, string Status, string Signature, string PayloadJson);
public sealed record RefundRequest(string TenantId, Guid PaymentId, decimal Amount, string Reason);

public sealed class Payment
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Provider { get; set; } = "Stripe";
    public string Status { get; set; } = "Paid";
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTimeOffset PaidAtUtc { get; set; }
}

public sealed class PaymentSession
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string InvoiceNumber { get; set; } = string.Empty;
    public string ProviderReference { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class PaymentWebhookReceipt
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string ProviderReference { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset ReceivedAtUtc { get; set; }
}

public sealed class PaymentRefund
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid PaymentId { get; set; }
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTimeOffset RequestedAtUtc { get; set; }
}

public sealed class ReconciliationRun
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public int PendingSessions { get; set; }
    public int CompletedSessions { get; set; }
    public DateTimeOffset ExecutedAtUtc { get; set; }
}

static class TenantExtensions
{
    public static string GetTenantId(this HttpContext httpContext) =>
        httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault() ?? "default";
}

public sealed class FinanceDbContext(DbContextOptions<FinanceDbContext> options) : DbContext(options)
{
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentSession> PaymentSessions => Set<PaymentSession>();
    public DbSet<PaymentWebhookReceipt> WebhookReceipts => Set<PaymentWebhookReceipt>();
    public DbSet<PaymentRefund> Refunds => Set<PaymentRefund>();
    public DbSet<ReconciliationRun> ReconciliationRuns => Set<ReconciliationRun>();
}

public sealed class PaymentReconciliationWorker(IServiceProvider serviceProvider, ILogger<PaymentReconciliationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
                var pending = await dbContext.PaymentSessions.Where(x => x.Status == "Pending").ToListAsync(stoppingToken);
                if (pending.Count > 0)
                {
                    dbContext.ReconciliationRuns.Add(new ReconciliationRun
                    {
                        Id = Guid.NewGuid(),
                        TenantId = pending[0].TenantId,
                        PendingSessions = pending.Count,
                        CompletedSessions = pending.Count(x => x.Status == "Paid"),
                        ExecutedAtUtc = DateTimeOffset.UtcNow
                    });

                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Payment reconciliation failed");
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}

public static class KnownUsers
{
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000123");
}
