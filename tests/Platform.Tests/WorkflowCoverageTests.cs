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
            [
                new ApplicationDocument { Status = "Requested", RequestedAtUtc = nowUtc.AddDays(-2), ApplicationId = Guid.NewGuid(), DocumentType = "Transcript" },
                new ApplicationDocument { Status = "Verified" },
                new ApplicationDocument { Status = "Delivered" }
            ],
            [new AdmissionCommunication { Channel = "Email", Status = "Sent" }],
            [new AdmissionReminder { Status = "Open", DueAtUtc = nowUtc.AddHours(-2) }, new AdmissionReminder { Status = "Completed" }]);

        summary.Total.Should().Be(1);
        summary.NewItems.Should().Be(1);
        summary.Applications.Submitted.Should().Be(1);
        summary.Applications.Qualified.Should().Be(1);
        summary.Counseling.Scheduled.Should().Be(1);
        summary.Counseling.Completed.Should().Be(1);
        summary.Documents.Pending.Should().Be(1);
        summary.Documents.Verified.Should().Be(2);
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

    [Fact]
    public void StudentWorkspaceSummary_CountsOpenRequestsAndRecentItems()
    {
        var student = new StudentRecord
        {
            Id = Guid.NewGuid(),
            Name = "Aarav Sharma",
            Department = "Computer Science",
            Batch = "2022",
            AcademicStatus = "Active"
        };
        var summary = StudentWorkspaceSummary.Create(
            student,
            [
                new StudentEnrollment { CourseCode = "CSE401", Status = "Enrolled", EnrolledAtUtc = DateTimeOffset.UtcNow },
                new StudentEnrollment { CourseCode = "PHY201", Status = "Enrolled", EnrolledAtUtc = DateTimeOffset.UtcNow.AddDays(-1) }
            ],
            [
                new StudentServiceRequest { RequestType = "Bonafide Letter", Status = "Submitted", RequestedAtUtc = DateTimeOffset.UtcNow },
                new StudentServiceRequest { RequestType = "Leave Request", Status = "In Review", RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-1) },
                new StudentServiceRequest { RequestType = "Fee Review", Status = "Completed", RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-2) }
            ]);

        summary.EnrollmentCount.Should().Be(2);
        summary.OpenRequests.Should().Be(2);
        summary.RecentEnrollments.Should().HaveCount(2);
        summary.RecentRequests.Should().HaveCount(3);
    }

    [Fact]
    public void StudentRequestSummary_CountsCertificateAndFulfillmentStates()
    {
        var summary = StudentRequestSummary.Create(
            [
                new StudentServiceRequest { RequestType = "Bonafide Letter", Status = "Submitted" },
                new StudentServiceRequest { RequestType = "Transcript Certificate", Status = "Fulfilled", FulfillmentReference = "CERT-2026-1004" },
                new StudentServiceRequest { RequestType = "Leave Request", Status = "Approved" }
            ]);

        summary.Total.Should().Be(3);
        summary.Submitted.Should().Be(1);
        summary.Approved.Should().Be(1);
        summary.Fulfilled.Should().Be(1);
        summary.CertificateRequests.Should().Be(2);
    }

    [Fact]
    public void GradeReviewSummary_CountsTeacherWorkflowStages()
    {
        var summary = GradeReviewSummary.Create(
            [
                new GradeReviewItem { Status = "Pending Review" },
                new GradeReviewItem { Status = "Ready To Publish" },
                new GradeReviewItem { Status = "Published" }
            ]);

        summary.Total.Should().Be(3);
        summary.Pending.Should().Be(1);
        summary.ReadyToPublish.Should().Be(1);
        summary.Published.Should().Be(1);
        summary.Items.Should().HaveCount(3);
    }

    [Fact]
    public void StudentFinanceSummary_TracksPaidTransactionsAndPendingSessions()
    {
        var summary = StudentFinanceSummary.Create(
            [
                new Payment { Amount = 45000, Status = "Paid", InvoiceNumber = "INV-2026-001", PaidAtUtc = DateTimeOffset.UtcNow.AddDays(-5) },
                new Payment { Amount = 12000, Status = "Paid", InvoiceNumber = "INV-2026-002", PaidAtUtc = DateTimeOffset.UtcNow.AddDays(-1) }
            ],
            [
                new PaymentSession { Status = "Pending", InvoiceNumber = "INV-2026-003", CreatedAtUtc = DateTimeOffset.UtcNow },
                new PaymentSession { Status = "Paid", InvoiceNumber = "INV-2026-000", CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2) }
            ]);

        summary.TotalPaid.Should().Be(57000);
        summary.TotalTransactions.Should().Be(2);
        summary.PendingSessions.Should().Be(1);
        summary.LatestPayment?.InvoiceNumber.Should().Be("INV-2026-002");
        summary.LatestSession?.InvoiceNumber.Should().Be("INV-2026-003");
    }

    [Fact]
    public void AdvisingNote_RetainsFacultyFollowUpMetadata()
    {
        var createdAtUtc = DateTimeOffset.UtcNow;
        var note = new AdvisingNote
        {
            TeacherId = Guid.NewGuid(),
            StudentName = "Aarav Sharma",
            CourseCode = "CSE401",
            Title = "Exam readiness counseling",
            Note = "Recommended focused practice on consistency models before the next internal review.",
            FollowUpStatus = "Open",
            CreatedAtUtc = createdAtUtc
        };

        note.CourseCode.Should().Be("CSE401");
        note.Title.Should().Be("Exam readiness counseling");
        note.FollowUpStatus.Should().Be("Open");
        note.CreatedAtUtc.Should().Be(createdAtUtc);
    }

    [Fact]
    public void TeacherAttendanceSummary_FlagsLowAttendanceCourses()
    {
        var sessionId = Guid.NewGuid();
        var summary = TeacherAttendanceSummary.Create(
            [new AttendanceSession { Id = sessionId, Status = "Active" }],
            [
                new AttendanceRecord { SessionId = sessionId, CourseCode = "PHY201", Status = "Present" },
                new AttendanceRecord { SessionId = sessionId, CourseCode = "PHY201", Status = "Absent" },
                new AttendanceRecord { SessionId = sessionId, CourseCode = "CSE401", Status = "Present" }
            ]);

        summary.TotalSessions.Should().Be(1);
        summary.ActiveSessions.Should().Be(1);
        summary.RecordsCaptured.Should().Be(3);
        summary.LowAttendanceCourses.Should().Be(1);
        summary.Alerts.Should().Contain(item => item.CourseCode == "PHY201" && item.Percentage < 75);
    }
}
