using FluentAssertions;
using IdentityService.Api.Domain;
using IdentityService.Api.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Platform.Tests;

public sealed class WorkflowCoverageTests
{
    [Fact]
    public void RouteGovernancePolicy_BlocksInjectedPatterns()
    {
        var policy = new RouteGovernancePolicy(new Microsoft.Extensions.Caching.Memory.MemoryCache(new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions()));
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/v1/results/<script>alert(1)</script>";

        policy.IsBlocked(context).Should().BeTrue();
    }

    [Fact]
    public void OrganizationCatalogMetrics_CalculatesHierarchyTotals()
    {
        var summary = OrganizationCatalogMetrics.Create(
            [new CollegeProfile()],
            [new CampusProfile { FacultyCount = 12, StudentCapacity = 400 }],
            [new AcademicProgramProfile { IsFeatured = true }, new AcademicProgramProfile()],
            [new DepartmentProfile(), new DepartmentProfile()],
            [new StaffDirectoryEntry(), new StaffDirectoryEntry(), new StaffDirectoryEntry()]);

        summary.Colleges.Should().Be(1);
        summary.Campuses.Should().Be(1);
        summary.Programs.Should().Be(2);
        summary.Departments.Should().Be(2);
        summary.FacultyCount.Should().Be(12);
        summary.StudentCapacity.Should().Be(400);
        summary.FeaturedPrograms.Should().Be(1);
        summary.StaffDirectoryEntries.Should().Be(3);
    }

    [Fact]
    public void AdmissionsWorkflowMetrics_IncludesCounselingAndDocumentSignals()
    {
        var inquiry = new AdmissionInquiry { Status = "New", CreatedAtUtc = DateTimeOffset.UtcNow };
        var nowUtc = DateTimeOffset.UtcNow;
        var summary = AdmissionsWorkflowMetrics.Create(
            [inquiry],
            [new AdmissionApplication { Status = "Submitted", UpdatedAtUtc = nowUtc.AddDays(-3), Id = Guid.NewGuid() }, new AdmissionApplication { Status = "Qualified" }],
            [new CounselingSession { Status = "Scheduled" }, new CounselingSession { Status = "Completed" }],
            [new ApplicationDocument { Status = "Requested", RequestedAtUtc = nowUtc.AddDays(-2), ApplicationId = Guid.NewGuid(), DocumentType = "Transcript" }, new ApplicationDocument { Status = "Verified" }],
            [new AdmissionCommunication { Channel = "Email", Status = "Sent" }],
            [new AdmissionReminder { Status = "Open", DueAtUtc = nowUtc.AddHours(-2) }, new AdmissionReminder { Status = "Completed" }]);

        summary.Total.Should().Be(1);
        summary.NewItems.Should().Be(1);
        summary.Applications.Submitted.Should().Be(1);
        summary.Applications.Qualified.Should().Be(1);
        summary.Counseling.Scheduled.Should().Be(1);
        summary.Counseling.Completed.Should().Be(1);
        summary.Documents.Pending.Should().Be(1);
        summary.Documents.Verified.Should().Be(1);
        summary.Communications.Email.Should().Be(1);
        summary.Reminders.Open.Should().Be(1);
        summary.Reminders.Completed.Should().Be(1);
        summary.Automation.StaleApplications.Should().Be(1);
        summary.Automation.OverdueReminders.Should().Be(1);
        summary.Automation.PendingDocumentFollowUps.Should().Be(1);
    }

    [Fact]
    public void AdmissionsAutomationEngine_CreatesEscalationAndDocumentFollowUpReminders()
    {
        var applicationId = Guid.NewGuid();
        var nowUtc = DateTimeOffset.UtcNow;
        var result = AdmissionsAutomationEngine.Run(
            "default",
            [
                new AdmissionApplication
                {
                    Id = applicationId,
                    ApplicantName = "Riya Menon",
                    Status = "Submitted",
                    UpdatedAtUtc = nowUtc.AddDays(-3)
                }
            ],
            [
                new ApplicationDocument
                {
                    ApplicationId = applicationId,
                    ApplicantName = "Riya Menon",
                    DocumentType = "Transcript",
                    Status = "Requested",
                    RequestedAtUtc = nowUtc.AddDays(-2)
                }
            ],
            [],
            [],
            nowUtc);

        result.CreatedReminders.Should().HaveCount(2);
        result.CreatedReminders.Should().Contain(item => item.ReminderType == "Admissions Escalation");
        result.CreatedReminders.Should().Contain(item => item.ReminderType == "Transcript follow-up");
        result.Metrics.EscalationsOpen.Should().Be(1);
    }

    [Fact]
    public void PaymentGatewayCatalog_ExposesOnlyEnabledReadyProviders()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Payments:Razorpay:Enabled"] = "true",
                ["Payments:Razorpay:PublicKey"] = "rzp_live_public",
                ["Payments:Razorpay:SecretKey"] = "rzp_live_secret",
                ["Payments:Razorpay:WebhookSecret"] = "rzp_live_webhook",
                ["Payments:Razorpay:CheckoutBaseUrl"] = "https://api.razorpay.com",
                ["Payments:Razorpay:MerchantName"] = "University360",
                ["Payments:Razorpay:SupportedCurrencies"] = "INR",
                ["Payments:Razorpay:RolloutStage"] = "Live",
                ["Payments:PayPal:Enabled"] = "false"
            })
            .Build();

        var catalog = new PaymentGatewayCatalog(configuration);
        var provider = catalog.GetProvider("Razorpay");

        provider.Should().NotBeNull();
        provider!.Enabled.Should().BeTrue();
        provider.IsReadyForCheckout.Should().BeTrue();
        provider.SupportedCurrencies.Should().Contain("INR");
    }

    [Fact]
    public void FederationReadinessCatalog_FlagsMissingSecrets()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Federation:Providers:Google:Enabled"] = "true",
                ["Federation:Providers:Google:CallbackUrl"] = "https://admin.university360.edu/auth/callback"
            })
            .Build();
        var catalog = new FederationReadinessCatalog(configuration);

        var readiness = catalog.Describe(new FederatedAuthProvider
        {
            Name = "Google",
            Enabled = true,
            ClientId = "google-live-client-id",
            AuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth",
            TokenEndpoint = "https://oauth2.googleapis.com/token"
        });

        readiness.Status.Should().Be("Configuration Required");
        readiness.ClientSecretConfigured.Should().BeFalse();
    }
}
