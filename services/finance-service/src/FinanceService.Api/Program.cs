using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<FinanceDbContext>();
builder.Services.AddHostedService<PaymentReconciliationWorker>();
builder.Services.AddSingleton<PaymentGatewayCatalog>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<FinanceDbContext>();
await SeedFinanceDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "finance-service", gateways = new[] { "Razorpay", "Stripe", "PayPal" } }));
app.MapGet("/api/v1/payment-providers", (PaymentGatewayCatalog gateways) => Results.Ok(gateways.GetProviders()))
    .RequirePermissions("finance.manage");
app.MapGet("/api/v1/payment-providers/readiness", (PaymentGatewayCatalog gateways) =>
        Results.Ok(new
        {
            total = gateways.GetProviders().Count,
            ready = gateways.GetProviders().Count(provider => provider.IsReadyForCheckout),
            items = gateways.GetProviders()
        }))
    .RequirePermissions("finance.manage");

app.MapPost("/api/v1/payments", async (HttpContext httpContext, [FromBody] RecordPaymentRequest request, FinanceDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var payment = new Payment
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = request.StudentId,
        Amount = request.Amount,
        Currency = request.Currency,
        Provider = request.Provider,
        Status = request.Status,
        PaidAtUtc = DateTimeOffset.UtcNow,
        InvoiceNumber = request.InvoiceNumber
    };

    dbContext.Payments.Add(payment);
    dbContext.AuditLogs.Add(FinanceAuditLog.Create(tenantId, "payment.recorded", payment.Id.ToString(), httpContext.User.Identity?.Name ?? "finance-service", $"Payment recorded for invoice {payment.InvoiceNumber} with status {payment.Status}."));
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/v1/payments/{payment.Id}", payment);
}).RequirePermissions("finance.manage");

app.MapGet("/api/v1/payments", async (HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.Payments.Where(x => x.TenantId == httpContext.GetValidatedTenantId()).OrderByDescending(x => x.PaidAtUtc).ToListAsync())
    .RequirePermissions("finance.manage");

app.MapGet("/api/v1/payments/{studentId:guid}", async (Guid studentId, HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.Payments.Where(x => x.TenantId == httpContext.GetValidatedTenantId() && x.StudentId == studentId).ToListAsync())
    .RequirePermissions("finance.manage");

app.MapPost("/api/v1/payment-sessions", async (HttpContext httpContext, [FromBody] PaymentSessionRequest request, FinanceDbContext dbContext, PaymentGatewayCatalog gateways) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var providerConfig = gateways.GetProvider(request.Provider);
    if (providerConfig is null)
    {
        return Results.BadRequest(new { message = "Unsupported payment provider" });
    }

    if (!providerConfig.Enabled)
    {
        return Results.BadRequest(new { message = $"{request.Provider} is not enabled for checkout rollout." });
    }

    if (!providerConfig.SupportedCurrencies.Contains(request.Currency, StringComparer.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { message = $"{request.Provider} does not support {request.Currency} in the current rollout." });
    }

    if (!providerConfig.IsReadyForCheckout)
    {
        return Results.BadRequest(new { message = $"{request.Provider} checkout is not configured for production-style use yet." });
    }

    var session = new PaymentSession
    {
        Id = Guid.NewGuid(),
        TenantId = httpContext.GetValidatedTenantId(),
        StudentId = request.StudentId,
        Provider = request.Provider,
        Amount = request.Amount,
        Currency = request.Currency,
        InvoiceNumber = request.InvoiceNumber,
        ProviderReference = $"{request.Provider.ToLowerInvariant()}_{Guid.NewGuid():N}",
        Status = "Pending",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        CheckoutUrl = $"{providerConfig.CheckoutBaseUrl.TrimEnd('/')}/{request.Provider.ToLowerInvariant()}/checkout/{Guid.NewGuid():N}",
        ProviderPublicKey = providerConfig.PublicKey
    };

    dbContext.PaymentSessions.Add(session);
    dbContext.AuditLogs.Add(FinanceAuditLog.Create(session.TenantId, "payment.session.created", session.Id.ToString(), httpContext.User.Identity?.Name ?? "finance-service", $"Payment session created for invoice {session.InvoiceNumber} via {session.Provider}."));
    await dbContext.SaveChangesAsync();

    return Results.Ok(new
    {
        sessionId = session.Id,
        provider = session.Provider,
        providerReference = session.ProviderReference,
        checkoutUrl = session.CheckoutUrl,
        publishableKey = session.ProviderPublicKey
    });
}).RequirePermissions("finance.manage");

app.MapPost("/api/v1/payment-webhooks/{provider}", async (string provider, [FromBody] PaymentWebhookRequest request, FinanceDbContext dbContext, PaymentGatewayCatalog gateways) =>
{
    if (!gateways.VerifyWebhook(provider, request.PayloadJson, request.Signature))
    {
        return Results.Unauthorized();
    }

    var session = await dbContext.PaymentSessions.FirstOrDefaultAsync(x => x.Provider == provider && x.ProviderReference == request.ProviderReference);
    if (session is null)
    {
        return Results.NotFound();
    }

    var alreadyProcessed = await dbContext.WebhookReceipts.AnyAsync(x => x.Provider == provider && x.ProviderReference == request.ProviderReference && x.Signature == request.Signature);
    if (alreadyProcessed || string.Equals(session.Status, "Paid", StringComparison.OrdinalIgnoreCase))
    {
        return Results.Accepted();
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
    dbContext.AuditLogs.Add(FinanceAuditLog.Create(session.TenantId, "payment.webhook.processed", session.Id.ToString(), provider, $"Webhook marked session {session.ProviderReference} as {request.Status}."));

    await dbContext.SaveChangesAsync();
    return Results.Accepted();
});

app.MapPost("/api/v1/payment-refunds", async (HttpContext httpContext, [FromBody] RefundRequest request, FinanceDbContext dbContext) =>
{
    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var payment = await dbContext.Payments.FirstOrDefaultAsync(x => x.Id == request.PaymentId && x.TenantId == tenantId);
    if (payment is null)
    {
        return Results.NotFound();
    }

    if (!string.Equals(payment.Status, "Paid", StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { message = "Only paid transactions can be refunded." });
    }

    if (request.Amount <= 0 || request.Amount > payment.Amount)
    {
        return Results.BadRequest(new { message = "Refund amount is invalid." });
    }

    payment.Status = "Refunded";
    dbContext.Refunds.Add(new PaymentRefund
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        PaymentId = request.PaymentId,
        Reason = request.Reason,
        Amount = request.Amount,
        RequestedAtUtc = DateTimeOffset.UtcNow
    });
    dbContext.AuditLogs.Add(FinanceAuditLog.Create(tenantId, "payment.refund.requested", payment.Id.ToString(), httpContext.User.Identity?.Name ?? "finance-service", $"Refund requested for invoice {payment.InvoiceNumber} amount {request.Amount}."));
    await dbContext.SaveChangesAsync();
    return Results.Accepted();
}).RequirePermissions("payments.refund");

app.MapGet("/api/v1/payments/summary", async (HttpContext httpContext, FinanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
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

app.MapGet("/api/v1/students/{studentId:guid}/summary", async (Guid studentId, HttpContext httpContext, FinanceDbContext dbContext) =>
{
    if (!CanAccessStudentFinance(httpContext, studentId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var payments = await dbContext.Payments
        .Where(x => x.TenantId == tenantId && x.StudentId == studentId)
        .OrderByDescending(x => x.PaidAtUtc)
        .ToListAsync();
    var sessions = await dbContext.PaymentSessions
        .Where(x => x.TenantId == tenantId && x.StudentId == studentId)
        .OrderByDescending(x => x.CreatedAtUtc)
        .ToListAsync();

    return Results.Ok(StudentFinanceSummary.Create(payments, sessions));
}).RequireRoles("Student", "Principal", "Admin", "FinanceStaff");

app.MapPost("/api/v1/students/{studentId:guid}/payment-sessions", async (Guid studentId, HttpContext httpContext, [FromBody] StudentPaymentSessionRequest request, FinanceDbContext dbContext, PaymentGatewayCatalog gateways) =>
{
    if (!CanAccessStudentFinance(httpContext, studentId))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    var providerConfig = gateways.GetProvider(request.Provider);
    if (providerConfig is null)
    {
        return Results.BadRequest(new { message = "Unsupported payment provider" });
    }

    if (!providerConfig.Enabled || !providerConfig.IsReadyForCheckout)
    {
        return Results.BadRequest(new { message = $"{request.Provider} is not available for student checkout right now." });
    }

    if (!providerConfig.SupportedCurrencies.Contains(request.Currency, StringComparer.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { message = $"{request.Provider} does not support {request.Currency} in the current rollout." });
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var session = new PaymentSession
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = studentId,
        Provider = request.Provider,
        Amount = request.Amount,
        Currency = request.Currency,
        InvoiceNumber = request.InvoiceNumber,
        ProviderReference = $"{request.Provider.ToLowerInvariant()}_{Guid.NewGuid():N}",
        Status = "Pending",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        CheckoutUrl = $"{providerConfig.CheckoutBaseUrl.TrimEnd('/')}/{request.Provider.ToLowerInvariant()}/checkout/{Guid.NewGuid():N}",
        ProviderPublicKey = providerConfig.PublicKey
    };

    dbContext.PaymentSessions.Add(session);
    dbContext.AuditLogs.Add(FinanceAuditLog.Create(tenantId, "student.payment-session.created", session.Id.ToString(), httpContext.User.Identity?.Name ?? "finance-service", $"Student payment session created for invoice {session.InvoiceNumber} via {session.Provider}."));
    await dbContext.SaveChangesAsync();

    return Results.Ok(new
    {
        sessionId = session.Id,
        provider = session.Provider,
        invoiceNumber = session.InvoiceNumber,
        providerReference = session.ProviderReference,
        checkoutUrl = session.CheckoutUrl,
        publishableKey = session.ProviderPublicKey,
        amount = session.Amount,
        currency = session.Currency
    });
}).RequireRoles("Student", "Principal", "Admin", "FinanceStaff");

app.MapGet("/api/v1/reconciliation/runs", async (HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.ReconciliationRuns.Where(x => x.TenantId == httpContext.GetValidatedTenantId()).OrderByDescending(x => x.ExecutedAtUtc).Take(20).ToListAsync())
    .RequirePermissions("finance.manage");

app.MapGet("/api/v1/audit-logs", async (HttpContext httpContext, FinanceDbContext dbContext, int page = 1, int pageSize = 20) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 100);
    var query = dbContext.AuditLogs.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.CreatedAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequirePermissions("finance.manage");

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

static bool CanAccessStudentFinance(HttpContext httpContext, Guid requestedUserId)
{
    var role = httpContext.User.FindFirst("role")?.Value
        ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
        ?? string.Empty;

    if (new[] { "Principal", "Admin", "FinanceStaff" }.Contains(role, StringComparer.OrdinalIgnoreCase))
    {
        return true;
    }

    var currentUserId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? httpContext.User.FindFirst("sub")?.Value;

    return Guid.TryParse(currentUserId, out var parsedUserId) && parsedUserId == requestedUserId;
}

public sealed record RecordPaymentRequest(string TenantId, Guid StudentId, decimal Amount, string Currency, string Provider, string Status, string InvoiceNumber);
public sealed record PaymentSessionRequest(string TenantId, Guid StudentId, decimal Amount, string Currency, string Provider, string InvoiceNumber);
public sealed record StudentPaymentSessionRequest(string TenantId, decimal Amount, string Currency, string Provider, string InvoiceNumber);
public sealed record PaymentWebhookRequest(string ProviderReference, string Status, string Signature, string PayloadJson);
public sealed record RefundRequest(string TenantId, Guid PaymentId, decimal Amount, string Reason);
public sealed record StudentFinanceSummary(
    decimal TotalPaid,
    int TotalTransactions,
    int PendingSessions,
    Payment? LatestPayment,
    PaymentSession? LatestSession)
{
    public static StudentFinanceSummary Create(IReadOnlyCollection<Payment> payments, IReadOnlyCollection<PaymentSession> sessions)
    {
        var orderedPayments = payments.OrderByDescending(x => x.PaidAtUtc).ToArray();
        var orderedSessions = sessions.OrderByDescending(x => x.CreatedAtUtc).ToArray();
        var paidPayments = orderedPayments.Where(x => string.Equals(x.Status, "Paid", StringComparison.OrdinalIgnoreCase)).ToArray();
        return new StudentFinanceSummary(
            paidPayments.Sum(x => x.Amount),
            paidPayments.Length,
            orderedSessions.Count(x => string.Equals(x.Status, "Pending", StringComparison.OrdinalIgnoreCase)),
            orderedPayments.FirstOrDefault(),
            orderedSessions.FirstOrDefault());
    }
}

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
    public string CheckoutUrl { get; set; } = string.Empty;
    public string ProviderPublicKey { get; set; } = string.Empty;
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

public sealed class FinanceAuditLog
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Action { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Actor { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    public static FinanceAuditLog Create(string tenantId, string action, string entityId, string actor, string details) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Action = action,
            EntityId = entityId,
            Actor = actor,
            Details = details,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
}

public sealed class FinanceDbContext(DbContextOptions<FinanceDbContext> options) : DbContext(options)
{
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentSession> PaymentSessions => Set<PaymentSession>();
    public DbSet<PaymentWebhookReceipt> WebhookReceipts => Set<PaymentWebhookReceipt>();
    public DbSet<PaymentRefund> Refunds => Set<PaymentRefund>();
    public DbSet<ReconciliationRun> ReconciliationRuns => Set<ReconciliationRun>();
    public DbSet<FinanceAuditLog> AuditLogs => Set<FinanceAuditLog>();
}

public sealed class PaymentGatewayCatalog(IConfiguration configuration)
{
    public IReadOnlyCollection<PaymentProviderConfiguration> GetProviders() =>
        new[] { "Razorpay", "Stripe", "PayPal" }.Select(GetProvider).OfType<PaymentProviderConfiguration>().ToArray();

    public PaymentProviderConfiguration? GetProvider(string providerName)
    {
        if (!new[] { "Razorpay", "Stripe", "PayPal" }.Contains(providerName, StringComparer.OrdinalIgnoreCase))
        {
            return null;
        }

        return new PaymentProviderConfiguration(
            providerName,
            bool.TryParse(configuration[$"Payments:{providerName}:Enabled"], out var enabled) && enabled,
            configuration[$"Payments:{providerName}:PublicKey"] ?? $"pk_test_{providerName.ToLowerInvariant()}",
            configuration[$"Payments:{providerName}:SecretKey"] ?? $"sk_test_{providerName.ToLowerInvariant()}",
            configuration[$"Payments:{providerName}:WebhookSecret"] ?? "development-webhook-secret",
            configuration[$"Payments:{providerName}:CheckoutBaseUrl"] ?? "https://payments.university360.local",
            configuration[$"Payments:{providerName}:MerchantName"] ?? "University360",
            SplitList(configuration[$"Payments:{providerName}:SupportedCurrencies"], "INR"),
            configuration[$"Payments:{providerName}:RolloutStage"] ?? "Sandbox");
    }

    public bool VerifyWebhook(string providerName, string payloadJson, string signature)
    {
        var provider = GetProvider(providerName);
        if (provider is null)
        {
            return false;
        }

        using var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(provider.WebhookSecret));
        var computed = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payloadJson))).ToLowerInvariant();
        return string.Equals(computed, signature, StringComparison.OrdinalIgnoreCase);
    }

    private static string[] SplitList(string? value, string fallback) =>
        (string.IsNullOrWhiteSpace(value) ? fallback : value)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

public sealed record PaymentProviderConfiguration(
    string Name,
    bool Enabled,
    string PublicKey,
    string SecretKey,
    string WebhookSecret,
    string CheckoutBaseUrl,
    string MerchantName,
    IReadOnlyCollection<string> SupportedCurrencies,
    string RolloutStage)
{
    public bool IsReadyForCheckout =>
        Enabled &&
        !string.IsNullOrWhiteSpace(PublicKey) &&
        !string.IsNullOrWhiteSpace(SecretKey) &&
        !string.IsNullOrWhiteSpace(WebhookSecret) &&
        !string.IsNullOrWhiteSpace(CheckoutBaseUrl) &&
        SupportedCurrencies.Count > 0;
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
                    dbContext.AuditLogs.Add(FinanceAuditLog.Create(pending[0].TenantId, "payment.reconciliation.executed", Guid.NewGuid().ToString(), "payment-reconciliation-worker", $"Reconciliation scanned {pending.Count} pending payment sessions."));

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
