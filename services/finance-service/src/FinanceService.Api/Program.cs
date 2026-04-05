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
    var charges = await dbContext.StudentCharges
        .Where(x => x.TenantId == tenantId && x.StudentId == studentId)
        .OrderBy(x => x.DueAtUtc)
        .ToListAsync();

    return Results.Ok(StudentFinanceSummary.Create(payments, sessions, charges));
}).RequireRoles("Student", "Principal", "Admin", "FinanceStaff");

app.MapGet("/api/v1/students/{studentId:guid}/charges", async (Guid studentId, HttpContext httpContext, FinanceDbContext dbContext) =>
{
    if (!CanAccessStudentFinance(httpContext, studentId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.StudentCharges
        .Where(x => x.TenantId == tenantId && x.StudentId == studentId)
        .OrderBy(x => x.DueAtUtc)
        .ToListAsync();

    return Results.Ok(new
    {
        items,
        total = items.Count,
        outstandingAmount = items.Where(item => !string.Equals(item.Status, "Paid", StringComparison.OrdinalIgnoreCase)).Sum(item => item.BalanceAmount),
        overdue = items.Count(item => !string.Equals(item.Status, "Paid", StringComparison.OrdinalIgnoreCase) && item.DueAtUtc < DateTimeOffset.UtcNow)
    });
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

app.MapPost("/api/v1/students/{studentId:guid}/charges/{chargeId:guid}/payment-sessions", async (Guid studentId, Guid chargeId, HttpContext httpContext, [FromBody] StudentChargePaymentSessionRequest request, FinanceDbContext dbContext, PaymentGatewayCatalog gateways) =>
{
    if (!CanAccessStudentFinance(httpContext, studentId))
    {
        return Results.Forbid();
    }

    httpContext.EnsureTenantAccess(request.TenantId);
    var tenantId = httpContext.GetValidatedTenantId();
    var charge = await dbContext.StudentCharges.FirstOrDefaultAsync(x => x.Id == chargeId && x.TenantId == tenantId && x.StudentId == studentId);
    if (charge is null)
    {
        return Results.NotFound();
    }

    if (string.Equals(charge.Status, "Paid", StringComparison.OrdinalIgnoreCase) || charge.BalanceAmount <= 0)
    {
        return Results.BadRequest(new { message = "This charge is already settled." });
    }

    var providerConfig = gateways.GetProvider(request.Provider);
    if (providerConfig is null)
    {
        return Results.BadRequest(new { message = "Unsupported payment provider" });
    }

    if (!providerConfig.Enabled || !providerConfig.IsReadyForCheckout)
    {
        return Results.BadRequest(new { message = $"{request.Provider} is not available for student checkout right now." });
    }

    if (!providerConfig.SupportedCurrencies.Contains(charge.Currency, StringComparer.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { message = $"{request.Provider} does not support {charge.Currency} in the current rollout." });
    }

    var session = new PaymentSession
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = studentId,
        Provider = request.Provider,
        Amount = charge.BalanceAmount,
        Currency = charge.Currency,
        InvoiceNumber = charge.InvoiceNumber,
        ProviderReference = $"{request.Provider.ToLowerInvariant()}_{Guid.NewGuid():N}",
        Status = "Pending",
        CreatedAtUtc = DateTimeOffset.UtcNow,
        CheckoutUrl = $"{providerConfig.CheckoutBaseUrl.TrimEnd('/')}/{request.Provider.ToLowerInvariant()}/checkout/{Guid.NewGuid():N}",
        ProviderPublicKey = providerConfig.PublicKey
    };

    dbContext.PaymentSessions.Add(session);
    dbContext.StudentChargeSessionLinks.Add(new StudentChargeSessionLink
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        StudentId = studentId,
        ChargeId = charge.Id,
        SessionId = session.Id,
        LinkedAtUtc = DateTimeOffset.UtcNow
    });
    dbContext.AuditLogs.Add(FinanceAuditLog.Create(tenantId, "student.charge.payment-session.created", session.Id.ToString(), httpContext.User.Identity?.Name ?? "finance-service", $"Payment session created for charge {charge.Title} via {session.Provider}."));
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
        currency = session.Currency,
        charge
    });
}).RequireRoles("Student", "Principal", "Admin", "FinanceStaff");

app.MapPost("/api/v1/students/{studentId:guid}/payment-sessions/{sessionId:guid}/complete", async (Guid studentId, Guid sessionId, HttpContext httpContext, FinanceDbContext dbContext) =>
{
    if (!CanAccessStudentFinance(httpContext, studentId))
    {
        return Results.Forbid();
    }

    var tenantId = httpContext.GetValidatedTenantId();
    var session = await dbContext.PaymentSessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.TenantId == tenantId && x.StudentId == studentId);
    if (session is null)
    {
        return Results.NotFound();
    }

    var existingPayment = await dbContext.Payments.FirstOrDefaultAsync(x =>
        x.TenantId == tenantId &&
        x.StudentId == studentId &&
        x.InvoiceNumber == session.InvoiceNumber &&
        x.Provider == session.Provider &&
        string.Equals(x.Status, "Paid", StringComparison.OrdinalIgnoreCase));

    session.Status = "Paid";

    if (existingPayment is null)
    {
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StudentId = studentId,
            Amount = session.Amount,
            Currency = session.Currency,
            Provider = session.Provider,
            Status = "Paid",
            PaidAtUtc = DateTimeOffset.UtcNow,
            InvoiceNumber = session.InvoiceNumber
        };

        dbContext.Payments.Add(payment);
        dbContext.AuditLogs.Add(FinanceAuditLog.Create(tenantId, "student.payment-session.completed", session.Id.ToString(), httpContext.User.Identity?.Name ?? "finance-service", $"Student payment session {session.InvoiceNumber} completed via {session.Provider}."));
        await dbContext.SaveChangesAsync();
        existingPayment = payment;
    }
    else
    {
        await dbContext.SaveChangesAsync();
    }

    var chargeLink = await dbContext.StudentChargeSessionLinks.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.StudentId == studentId && x.SessionId == sessionId);
    StudentCharge? charge = null;
    if (chargeLink is not null)
    {
        charge = await dbContext.StudentCharges.FirstOrDefaultAsync(x => x.Id == chargeLink.ChargeId && x.TenantId == tenantId && x.StudentId == studentId);
        if (charge is not null)
        {
            charge.Status = "Paid";
            charge.BalanceAmount = 0;
            charge.SettledAtUtc = DateTimeOffset.UtcNow;
            charge.Note = $"Settled via {session.Provider} session {session.InvoiceNumber}.";
            await dbContext.SaveChangesAsync();
        }
    }

    return Results.Ok(new
    {
        session,
        payment = existingPayment,
        charge
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

app.MapGet("/api/v1/procurement/summary", async (HttpContext httpContext, FinanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var vendors = await dbContext.Vendors.Where(x => x.TenantId == tenantId).ToListAsync();
    var requisitions = await dbContext.PurchaseRequisitions.Where(x => x.TenantId == tenantId).ToListAsync();
    var purchaseOrders = await dbContext.PurchaseOrders.Where(x => x.TenantId == tenantId).ToListAsync();
    var inventoryItems = await dbContext.InventoryItems.Where(x => x.TenantId == tenantId).ToListAsync();

    return Results.Ok(ProcurementSummary.Create(vendors, requisitions, purchaseOrders, inventoryItems));
}).RequirePermissions("finance.manage");

app.MapGet("/api/v1/procurement/vendors", async (HttpContext httpContext, FinanceDbContext dbContext) =>
    await dbContext.Vendors.Where(x => x.TenantId == httpContext.GetValidatedTenantId()).OrderBy(x => x.Name).ToListAsync())
    .RequirePermissions("finance.manage");

app.MapGet("/api/v1/procurement/requisitions", async (HttpContext httpContext, FinanceDbContext dbContext, int page = 1, int pageSize = 10) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 50);
    var query = dbContext.PurchaseRequisitions.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.RequestedAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequirePermissions("finance.manage");

app.MapPost("/api/v1/procurement/requisitions/{id:guid}/status", async (Guid id, HttpContext httpContext, UpdateProcurementStatusRequest request, FinanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.PurchaseRequisitions.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status;
    item.ApproverName = string.IsNullOrWhiteSpace(request.ActorName) ? item.ApproverName : request.ActorName.Trim();
    item.Note = string.IsNullOrWhiteSpace(request.Note) ? item.Note : request.Note.Trim();
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequirePermissions("finance.manage");

app.MapGet("/api/v1/procurement/purchase-orders", async (HttpContext httpContext, FinanceDbContext dbContext, int page = 1, int pageSize = 10) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 50);
    var query = dbContext.PurchaseOrders.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.IssuedAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequirePermissions("finance.manage");

app.MapPost("/api/v1/procurement/purchase-orders/{id:guid}/status", async (Guid id, HttpContext httpContext, UpdateProcurementStatusRequest request, FinanceDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.PurchaseOrders.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status;
    item.UpdatedBy = string.IsNullOrWhiteSpace(request.ActorName) ? item.UpdatedBy : request.ActorName.Trim();
    item.Note = string.IsNullOrWhiteSpace(request.Note) ? item.Note : request.Note.Trim();
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequirePermissions("finance.manage");

app.MapGet("/api/v1/procurement/inventory", async (HttpContext httpContext, FinanceDbContext dbContext, int page = 1, int pageSize = 10) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 50);
    var query = dbContext.InventoryItems.Where(x => x.TenantId == tenantId).OrderBy(x => x.Name);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequirePermissions("finance.manage");

app.Run();

static async Task SeedFinanceDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();

    if (!await dbContext.Payments.AnyAsync())
    {
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
    }

    if (!await dbContext.PaymentSessions.AnyAsync())
    {
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
    }

    if (!await dbContext.StudentCharges.AnyAsync())
    {
        dbContext.StudentCharges.AddRange(
        [
            new StudentCharge
            {
                Id = Guid.Parse("56000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                StudentId = KnownUsers.StudentId,
                ChargeType = "Tuition",
                Title = "Semester tuition installment",
                InvoiceNumber = "INV-2026-003",
                Amount = 8000,
                BalanceAmount = 8000,
                Currency = "INR",
                Status = "Due",
                DueAtUtc = DateTimeOffset.UtcNow.AddDays(5),
                Note = "Pending student checkout for the current installment."
            },
            new StudentCharge
            {
                Id = Guid.Parse("56000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                StudentId = KnownUsers.StudentId,
                ChargeType = "Examination",
                Title = "Examination registration fee",
                InvoiceNumber = "INV-2026-004",
                Amount = 2500,
                BalanceAmount = 2500,
                Currency = "INR",
                Status = "Due",
                DueAtUtc = DateTimeOffset.UtcNow.AddDays(12),
                Note = "Required before exam hall-ticket release."
            },
            new StudentCharge
            {
                Id = Guid.Parse("56000000-0000-0000-0000-000000000003"),
                TenantId = "default",
                StudentId = KnownUsers.StudentId,
                ChargeType = "Library",
                Title = "Library caution adjustment",
                InvoiceNumber = "INV-2026-001",
                Amount = 1200,
                BalanceAmount = 0,
                Currency = "INR",
                Status = "Paid",
                DueAtUtc = DateTimeOffset.UtcNow.AddDays(-20),
                SettledAtUtc = DateTimeOffset.UtcNow.AddDays(-15),
                Note = "Settled during the last fee cycle."
            }
        ]);
    }

    if (!await dbContext.Vendors.AnyAsync())
    {
        dbContext.Vendors.AddRange(
        [
            new VendorProfile
            {
                Id = Guid.Parse("51000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                Code = "VND-ICT-001",
                Name = "Campus Tech Supplies",
                CategoryName = "IT Equipment",
                Status = "Active",
                ContactEmail = "sales@campustech.example",
                City = "Bengaluru",
                OnboardedAtUtc = DateTimeOffset.UtcNow.AddMonths(-18),
                LastOrderAtUtc = DateTimeOffset.UtcNow.AddDays(-12)
            },
            new VendorProfile
            {
                Id = Guid.Parse("51000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                Code = "VND-LAB-002",
                Name = "Labline Scientific",
                CategoryName = "Lab Consumables",
                Status = "Active",
                ContactEmail = "support@labline.example",
                City = "Chennai",
                OnboardedAtUtc = DateTimeOffset.UtcNow.AddMonths(-10),
                LastOrderAtUtc = DateTimeOffset.UtcNow.AddDays(-5)
            }
        ]);
    }

    if (!await dbContext.PurchaseRequisitions.AnyAsync())
    {
        dbContext.PurchaseRequisitions.AddRange(
        [
            new PurchaseRequisition
            {
                Id = Guid.Parse("52000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                Title = "Replace projector units for seminar halls",
                DepartmentName = "Campus Services",
                RequesterName = "Madhav Iyer",
                Status = "Pending Approval",
                Priority = "High",
                Amount = 185000,
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-3),
                RequiredByUtc = DateTimeOffset.UtcNow.AddDays(10),
                ApproverName = "Finance Controller",
                Note = "Needed before placement week."
            },
            new PurchaseRequisition
            {
                Id = Guid.Parse("52000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                Title = "Biochemistry reagent refill",
                DepartmentName = "Biosciences",
                RequesterName = "Dr. Asha Varma",
                Status = "Approved",
                Priority = "Medium",
                Amount = 62000,
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-8),
                RequiredByUtc = DateTimeOffset.UtcNow.AddDays(5),
                ApproverName = "Procurement Desk",
                Note = "Approved for PO creation."
            }
        ]);
    }

    if (!await dbContext.PurchaseOrders.AnyAsync())
    {
        dbContext.PurchaseOrders.AddRange(
        [
            new PurchaseOrder
            {
                Id = Guid.Parse("53000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                RequisitionId = Guid.Parse("52000000-0000-0000-0000-000000000002"),
                OrderNumber = "PO-2026-1001",
                VendorName = "Labline Scientific",
                Status = "Issued",
                Amount = 62000,
                IssuedAtUtc = DateTimeOffset.UtcNow.AddDays(-2),
                ExpectedDeliveryUtc = DateTimeOffset.UtcNow.AddDays(4),
                UpdatedBy = "Procurement Desk",
                Note = "Awaiting dispatch confirmation."
            }
        ]);
    }

    if (!await dbContext.InventoryItems.AnyAsync())
    {
        dbContext.InventoryItems.AddRange(
        [
            new InventoryItem
            {
                Id = Guid.Parse("54000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                Sku = "IT-PROJ-01",
                Name = "Seminar Hall Projector",
                CategoryName = "AV Equipment",
                CampusName = "North City Campus",
                InStockQuantity = 1,
                ReorderLevel = 2,
                Unit = "units",
                Status = "Low Stock",
                LastReceivedAtUtc = DateTimeOffset.UtcNow.AddMonths(-4)
            },
            new InventoryItem
            {
                Id = Guid.Parse("54000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                Sku = "LAB-REAG-07",
                Name = "Biochemistry Reagent Kit",
                CategoryName = "Lab Consumables",
                CampusName = "Health Sciences Campus",
                InStockQuantity = 14,
                ReorderLevel = 10,
                Unit = "kits",
                Status = "Healthy",
                LastReceivedAtUtc = DateTimeOffset.UtcNow.AddDays(-6)
            }
        ]);
    }

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
public sealed record StudentChargePaymentSessionRequest(string TenantId, string Provider);
public sealed record PaymentWebhookRequest(string ProviderReference, string Status, string Signature, string PayloadJson);
public sealed record RefundRequest(string TenantId, Guid PaymentId, decimal Amount, string Reason);
public sealed record UpdateProcurementStatusRequest(string Status, string? ActorName, string? Note);
public sealed record StudentFinanceSummary(
    decimal TotalPaid,
    int TotalTransactions,
    int PendingSessions,
    decimal OutstandingAmount,
    int OverdueCharges,
    Payment? LatestPayment,
    PaymentSession? LatestSession,
    StudentCharge? NextCharge)
{
    public static StudentFinanceSummary Create(IReadOnlyCollection<Payment> payments, IReadOnlyCollection<PaymentSession> sessions, IReadOnlyCollection<StudentCharge> charges)
    {
        var orderedPayments = payments.OrderByDescending(x => x.PaidAtUtc).ToArray();
        var orderedSessions = sessions.OrderByDescending(x => x.CreatedAtUtc).ToArray();
        var paidPayments = orderedPayments.Where(x => string.Equals(x.Status, "Paid", StringComparison.OrdinalIgnoreCase)).ToArray();
        var openCharges = charges
            .Where(x => !string.Equals(x.Status, "Paid", StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x.DueAtUtc)
            .ToArray();
        return new StudentFinanceSummary(
            paidPayments.Sum(x => x.Amount),
            paidPayments.Length,
            orderedSessions.Count(x => string.Equals(x.Status, "Pending", StringComparison.OrdinalIgnoreCase)),
            openCharges.Sum(x => x.BalanceAmount),
            openCharges.Count(x => x.DueAtUtc < DateTimeOffset.UtcNow),
            orderedPayments.FirstOrDefault(),
            orderedSessions.FirstOrDefault(),
            openCharges.FirstOrDefault());
    }
}

public sealed record ProcurementSnapshot(
    int ActiveVendors,
    int OpenRequisitions,
    int PendingApproval,
    int PurchaseOrdersOpen,
    int ReorderAlerts,
    decimal MonthlyCommittedSpend);

public static class ProcurementSummary
{
    public static ProcurementSnapshot Create(
        IReadOnlyCollection<VendorProfile> vendors,
        IReadOnlyCollection<PurchaseRequisition> requisitions,
        IReadOnlyCollection<PurchaseOrder> purchaseOrders,
        IReadOnlyCollection<InventoryItem> inventoryItems)
    {
        var activeVendors = vendors.Count(x => string.Equals(x.Status, "Active", StringComparison.OrdinalIgnoreCase));
        var openRequisitions = requisitions.Count(x => !string.Equals(x.Status, "Rejected", StringComparison.OrdinalIgnoreCase) && !string.Equals(x.Status, "Closed", StringComparison.OrdinalIgnoreCase));
        var pendingApproval = requisitions.Count(x => x.Status.Contains("Pending", StringComparison.OrdinalIgnoreCase));
        var purchaseOrdersOpen = purchaseOrders.Count(x => !string.Equals(x.Status, "Delivered", StringComparison.OrdinalIgnoreCase) && !string.Equals(x.Status, "Closed", StringComparison.OrdinalIgnoreCase));
        var reorderAlerts = inventoryItems.Count(x => x.InStockQuantity <= x.ReorderLevel);
        var monthStart = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var monthlyCommittedSpend = requisitions.Where(x => x.RequestedAtUtc >= monthStart).Sum(x => x.Amount) + purchaseOrders.Where(x => x.IssuedAtUtc >= monthStart).Sum(x => x.Amount);

        return new ProcurementSnapshot(activeVendors, openRequisitions, pendingApproval, purchaseOrdersOpen, reorderAlerts, monthlyCommittedSpend);
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

public sealed class StudentCharge
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public string ChargeType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string InvoiceNumber { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal BalanceAmount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = "Due";
    public DateTimeOffset DueAtUtc { get; set; }
    public DateTimeOffset? SettledAtUtc { get; set; }
    public string Note { get; set; } = string.Empty;
}

public sealed class StudentChargeSessionLink
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid StudentId { get; set; }
    public Guid ChargeId { get; set; }
    public Guid SessionId { get; set; }
    public DateTimeOffset LinkedAtUtc { get; set; }
}

public sealed class ReconciliationRun
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public int PendingSessions { get; set; }
    public int CompletedSessions { get; set; }
    public DateTimeOffset ExecutedAtUtc { get; set; }
}

public sealed class VendorProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public string ContactEmail { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public DateTimeOffset OnboardedAtUtc { get; set; }
    public DateTimeOffset? LastOrderAtUtc { get; set; }
}

public sealed class PurchaseRequisition
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Title { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string RequesterName { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Approval";
    public string Priority { get; set; } = "Medium";
    public decimal Amount { get; set; }
    public DateTimeOffset RequestedAtUtc { get; set; }
    public DateTimeOffset RequiredByUtc { get; set; }
    public string ApproverName { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}

public sealed class PurchaseOrder
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid RequisitionId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string Status { get; set; } = "Issued";
    public decimal Amount { get; set; }
    public DateTimeOffset IssuedAtUtc { get; set; }
    public DateTimeOffset ExpectedDeliveryUtc { get; set; }
    public string UpdatedBy { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}

public sealed class InventoryItem
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string CampusName { get; set; } = string.Empty;
    public int InStockQuantity { get; set; }
    public int ReorderLevel { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string Status { get; set; } = "Healthy";
    public DateTimeOffset LastReceivedAtUtc { get; set; }
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
    public DbSet<StudentCharge> StudentCharges => Set<StudentCharge>();
    public DbSet<StudentChargeSessionLink> StudentChargeSessionLinks => Set<StudentChargeSessionLink>();
    public DbSet<VendorProfile> Vendors => Set<VendorProfile>();
    public DbSet<PurchaseRequisition> PurchaseRequisitions => Set<PurchaseRequisition>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
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
