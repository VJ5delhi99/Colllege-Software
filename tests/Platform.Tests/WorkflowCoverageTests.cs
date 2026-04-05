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
    public void AdmissionsCounselorWorkloadSummary_FlagsBusyAndBalancedCounselors()
    {
        var nowUtc = DateTimeOffset.UtcNow;
        var summary = AdmissionsCounselorWorkloadSummary.Create(
            [
                new AdmissionApplication { AssignedTo = "Ananya Rao", Status = "Submitted", UpdatedAtUtc = nowUtc.AddDays(-2) },
                new AdmissionApplication { AssignedTo = "Ananya Rao", Status = "Under Review", UpdatedAtUtc = nowUtc.AddHours(-10) },
                new AdmissionApplication { AssignedTo = "Rahul George", Status = "Qualified", UpdatedAtUtc = nowUtc.AddHours(-8) }
            ],
            [
                new CounselingSession { CounselorName = "Ananya Rao", Status = "Scheduled", ScheduledAtUtc = nowUtc.AddHours(4) }
            ],
            nowUtc);

        summary.TotalCounselors.Should().BeGreaterThan(1);
        summary.Items.Should().Contain(item => item.CounselorName == "Ananya Rao" && item.TotalLoad >= 3);
        summary.Items.Should().Contain(item => item.CounselorName == "Rahul George");
    }

    [Fact]
    public void AdmissionsOutreachEngine_CreatesTemplateDrivenCommunicationAndBalancesAssignments()
    {
        var nowUtc = DateTimeOffset.UtcNow;
        var applicationId = Guid.NewGuid();
        var run = AdmissionsOutreachEngine.Run(
            "default",
            [
                new AdmissionApplication
                {
                    Id = applicationId,
                    ApplicantName = "Riya Menon",
                    AssignedTo = "Ananya Rao",
                    Status = "Submitted",
                    UpdatedAtUtc = nowUtc.AddDays(-3)
                }
            ],
            [],
            [],
            [],
            [],
            [
                new AdmissionJourneyTemplate { TemplateName = "Stale Application Follow-Up", TriggerType = "StaleApplication", Channel = "Email", Subject = "Follow up", Body = "Body", IsActive = true },
                new AdmissionJourneyTemplate { TemplateName = "Document Checklist Reminder", TriggerType = "DocumentFollowUp", Channel = "SMS", Subject = "Docs", Body = "Body", IsActive = true }
            ],
            nowUtc);

        run.CreatedCommunications.Should().HaveCount(1);
        run.CreatedCommunications.First().TemplateName.Should().Be("Stale Application Follow-Up");
        run.RebalancedApplications.Should().Be(0);
    }

    [Fact]
    public void GovernanceOperationsSummary_CountsFacilityResearchComplianceAndIncubationSignals()
    {
        var summary = GovernanceOperationsSummary.Create(
            [
                new FacilityWorkOrder { Status = "Scheduled", AmcStatus = "Expiring Soon" },
                new FacilityWorkOrder { Status = "Completed", AmcStatus = "Healthy" }
            ],
            [
                new ResearchProject { Status = "Active", ComplianceStatus = "Report Due" },
                new ResearchProject { Status = "Completed", ComplianceStatus = "Closed" }
            ],
            [
                new AccreditationInitiative { Status = "Evidence Collection", DueAtUtc = DateTimeOffset.UtcNow.AddDays(5) },
                new AccreditationInitiative { Status = "Closed", DueAtUtc = DateTimeOffset.UtcNow.AddDays(30) }
            ],
            [
                new LegalCaseItem { Status = "Response Drafting" },
                new LegalCaseItem { Status = "Closed" }
            ],
            [
                new IncubationStartup { Status = "Mentoring" },
                new IncubationStartup { Status = "Graduated" }
            ],
            [
                new EstateContract { Status = "Renewal Review", RenewalDueAtUtc = DateTimeOffset.UtcNow.AddDays(10) },
                new EstateContract { Status = "Active", RenewalDueAtUtc = DateTimeOffset.UtcNow.AddDays(60) }
            ],
            [
                new CampusPlanningInitiative { Status = "Board Review", DueAtUtc = DateTimeOffset.UtcNow.AddDays(7) },
                new CampusPlanningInitiative { Status = "Closed", DueAtUtc = DateTimeOffset.UtcNow.AddDays(40) }
            ],
            [
                new ResourceGenerationCampaign { Status = "Prospect Outreach" },
                new ResourceGenerationCampaign { Status = "Closed" }
            ]);

        summary.OpenWorkOrders.Should().Be(1);
        summary.AmcExpiring.Should().Be(1);
        summary.ActiveProjects.Should().Be(1);
        summary.ComplianceDeadlines.Should().Be(2);
        summary.OpenRtiCases.Should().Be(1);
        summary.ActiveIncubations.Should().Be(1);
        summary.ContractRenewalsDue.Should().Be(1);
        summary.PlanningMilestonesDue.Should().Be(1);
        summary.ActiveResourceCampaigns.Should().Be(1);
    }

    [Fact]
    public void BudgetPlanningSummary_CountsPlansForecastsAndFundingGap()
    {
        var summary = BudgetPlanningSummary.Create(
            [
                new BudgetPlan { Status = "Board Review", OperatingBudgetAmount = 185000000, CapitalBudgetAmount = 42000000, CommittedSpendAmount = 61000000 },
                new BudgetPlan { Status = "Approved", OperatingBudgetAmount = 28000000, CapitalBudgetAmount = 3500000, CommittedSpendAmount = 8500000 }
            ],
            [
                new BudgetForecastScenario { Status = "Open", FundingGapAmount = 28000000 },
                new BudgetForecastScenario { Status = "Approved", FundingGapAmount = 15000000 }
            ]);

        summary.PlansUnderReview.Should().Be(1);
        summary.ForecastScenariosOpen.Should().Be(1);
        summary.OperatingBudgetAmount.Should().Be(213000000);
        summary.CapitalBudgetAmount.Should().Be(45500000);
        summary.CommittedSpendAmount.Should().Be(69500000);
        summary.FundingGapAmount.Should().Be(43000000);
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
                new StudentServiceRequest { RequestType = "Fee Review", Status = "Completed", RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-2), DownloadUrl = "https://download.local/file.pdf" }
            ],
            [
                new StudentRequestWorkflowStep { StepKind = "PaymentClearance", Status = "Pending" }
            ]);

        summary.EnrollmentCount.Should().Be(2);
        summary.OpenRequests.Should().Be(2);
        summary.ReadyForDownload.Should().Be(1);
        summary.RequestsAwaitingClearance.Should().Be(1);
        summary.RecentEnrollments.Should().HaveCount(2);
        summary.RecentRequests.Should().HaveCount(3);
    }

    [Fact]
    public void StudentRequestSummary_CountsCertificateAndFulfillmentStates()
    {
        var summary = StudentRequestSummary.Create(
            [
                new StudentServiceRequest { RequestType = "Bonafide Letter", Status = "Submitted" },
                new StudentServiceRequest { RequestType = "Transcript Certificate", Status = "Fulfilled", FulfillmentReference = "CERT-2026-1004", DownloadUrl = "https://download.local/file.pdf" },
                new StudentServiceRequest { RequestType = "Leave Request", Status = "Approved" }
            ],
            [
                new StudentRequestWorkflowStep { StepKind = "PaymentClearance", Status = "Pending" }
            ]);

        summary.Total.Should().Be(3);
        summary.Submitted.Should().Be(1);
        summary.Approved.Should().Be(1);
        summary.Fulfilled.Should().Be(1);
        summary.CertificateRequests.Should().Be(2);
        summary.ReadyForDownload.Should().Be(1);
        summary.AwaitingPaymentClearance.Should().Be(1);
    }

    [Fact]
    public void HumanResourcesSummary_CountsOnboardingLeaveAndRecruitmentSignals()
    {
        var summary = HumanResourcesSummary.Create(
            [
                new EmployeeProfile { Status = "Active", OnboardingStatus = "Completed" },
                new EmployeeProfile { Status = "Active", OnboardingStatus = "In Progress" }
            ],
            [
                new LeaveRequest { Status = "Pending Approval" },
                new LeaveRequest { Status = "Approved" }
            ],
            [
                new RecruitmentOpening { Status = "Open" },
                new RecruitmentOpening { Status = "Closed" }
            ],
            [
                new AppraisalCycle { Status = "Self Review Submitted", DueAtUtc = DateTimeOffset.UtcNow.AddDays(3) },
                new AppraisalCycle { Status = "Completed", DueAtUtc = DateTimeOffset.UtcNow.AddDays(-3) }
            ]);

        summary.ActiveEmployees.Should().Be(2);
        summary.OnboardingInProgress.Should().Be(1);
        summary.PendingLeaveRequests.Should().Be(1);
        summary.OpenRecruitment.Should().Be(1);
        summary.AppraisalsDueSoon.Should().Be(1);
        summary.CompletedAppraisals.Should().Be(1);
    }

    [Fact]
    public void ProcurementSummary_CountsPendingApprovalsAndReorderRisk()
    {
        var summary = ProcurementSummary.Create(
            [
                new VendorProfile { Status = "Active" },
                new VendorProfile { Status = "Inactive" }
            ],
            [
                new PurchaseRequisition { Status = "Pending Approval", Amount = 15000, RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-2) },
                new PurchaseRequisition { Status = "Approved", Amount = 12000, RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-5) }
            ],
            [
                new PurchaseOrder { Status = "Issued", Amount = 22000, IssuedAtUtc = DateTimeOffset.UtcNow.AddDays(-1) },
                new PurchaseOrder { Status = "Delivered", Amount = 9000, IssuedAtUtc = DateTimeOffset.UtcNow.AddDays(-7) }
            ],
            [
                new InventoryItem { InStockQuantity = 1, ReorderLevel = 2 },
                new InventoryItem { InStockQuantity = 10, ReorderLevel = 4 }
            ]);

        summary.ActiveVendors.Should().Be(1);
        summary.OpenRequisitions.Should().Be(2);
        summary.PendingApproval.Should().Be(1);
        summary.PurchaseOrdersOpen.Should().Be(1);
        summary.ReorderAlerts.Should().Be(1);
        summary.MonthlyCommittedSpend.Should().BeGreaterThan(0);
    }

    [Fact]
    public void AssessmentPublicationItem_RetainsPublishingMetadata()
    {
        var updatedAtUtc = DateTimeOffset.UtcNow;
        var item = new AssessmentPublicationItem
        {
            CourseCode = "PHY201",
            AssessmentName = "Internal Quiz 2",
            Status = "Ready To Publish",
            ModerationNote = "Board reviewed",
            UpdatedAtUtc = updatedAtUtc
        };

        item.AssessmentName.Should().Be("Internal Quiz 2");
        item.Status.Should().Be("Ready To Publish");
        item.ModerationNote.Should().Be("Board reviewed");
        item.UpdatedAtUtc.Should().Be(updatedAtUtc);
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
            ],
            [
                new StudentCharge { Title = "Semester tuition installment", BalanceAmount = 8000, Status = "Due", DueAtUtc = DateTimeOffset.UtcNow.AddDays(5) },
                new StudentCharge { Title = "Exam registration fee", BalanceAmount = 2500, Status = "Due", DueAtUtc = DateTimeOffset.UtcNow.AddDays(-1) }
            ]);

        summary.TotalPaid.Should().Be(57000);
        summary.TotalTransactions.Should().Be(2);
        summary.PendingSessions.Should().Be(1);
        summary.OutstandingAmount.Should().Be(10500);
        summary.OverdueCharges.Should().Be(1);
        summary.LatestPayment?.InvoiceNumber.Should().Be("INV-2026-002");
        summary.LatestSession?.InvoiceNumber.Should().Be("INV-2026-003");
        summary.NextCharge?.Title.Should().Be("Exam registration fee");
    }

    [Fact]
    public void HelpdeskTicketSummary_CountsOperationalQueueStates()
    {
        var summary = HelpdeskTicketSummary.Create(
            [
                new HelpdeskTicket { Status = "Open", Priority = "High" },
                new HelpdeskTicket { Status = "In Progress", Priority = "Medium" },
                new HelpdeskTicket { Status = "Resolved", Priority = "Low" }
            ]);

        summary.Total.Should().Be(3);
        summary.Open.Should().Be(1);
        summary.InProgress.Should().Be(1);
        summary.Resolved.Should().Be(1);
        summary.HighPriority.Should().Be(1);
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
    public void FacultyAdministrationSummary_CountsOfficeHoursCoverRequestsAndPlanStages()
    {
        var summary = FacultyAdministrationSummary.Create(
            [
                new FacultyOfficeHour { Status = "Scheduled" },
                new FacultyOfficeHour { Status = "Cancelled" }
            ],
            [
                new FacultySubstitutionRequest { Status = "Pending" },
                new FacultySubstitutionRequest { Status = "Approved" }
            ],
            [
                new FacultyCoursePlan { Status = "Submitted" },
                new FacultyCoursePlan { Status = "Approved" },
                new FacultyCoursePlan { Status = "Draft" }
            ],
            [
                new AdvisingNote { FollowUpStatus = "Open" },
                new AdvisingNote { FollowUpStatus = "Closed" }
            ],
            [
                new FacultyTimetableChangeRequest { Status = "Pending" },
                new FacultyTimetableChangeRequest { Status = "Approved" }
            ],
            [
                new FacultyMentoringAssignment { RiskLevel = "High", Status = "Meeting Scheduled" },
                new FacultyMentoringAssignment { RiskLevel = "Low", Status = "Support Plan Active" }
            ]);

        summary.OfficeHoursScheduled.Should().Be(1);
        summary.PendingClassCoverRequests.Should().Be(1);
        summary.CoursePlansAwaitingApproval.Should().Be(1);
        summary.ApprovedCoursePlans.Should().Be(1);
        summary.AdviseeFollowUpsOpen.Should().Be(1);
        summary.PendingTimetableChanges.Should().Be(1);
        summary.MentoringStudents.Should().Be(2);
        summary.MentoringAlerts.Should().Be(1);
    }

    [Fact]
    public void ExamBoardSummary_CountsReviewReleaseAndDueSoonSignals()
    {
        var summary = ExamBoardSummary.Create(
            [
                new ExamBoardItem { Status = "Board Review", DueAtUtc = DateTimeOffset.UtcNow.AddDays(2) },
                new ExamBoardItem { Status = "Ready To Release", DueAtUtc = DateTimeOffset.UtcNow.AddDays(1) },
                new ExamBoardItem { Status = "Released", DueAtUtc = DateTimeOffset.UtcNow.AddDays(-1) }
            ]);

        summary.Total.Should().Be(3);
        summary.BoardReview.Should().Be(1);
        summary.ReadyToRelease.Should().Be(1);
        summary.Released.Should().Be(1);
        summary.DueSoon.Should().Be(2);
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
