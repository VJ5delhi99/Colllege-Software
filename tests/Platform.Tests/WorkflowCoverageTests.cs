using FluentAssertions;
using Microsoft.AspNetCore.Http;
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
        var summary = AdmissionsWorkflowMetrics.Create(
            [inquiry],
            [new AdmissionApplication { Status = "Submitted" }, new AdmissionApplication { Status = "Qualified" }],
            [new CounselingSession { Status = "Scheduled" }, new CounselingSession { Status = "Completed" }],
            [new ApplicationDocument { Status = "Requested" }, new ApplicationDocument { Status = "Verified" }]);

        summary.Total.Should().Be(1);
        summary.NewItems.Should().Be(1);
        summary.Applications.Submitted.Should().Be(1);
        summary.Applications.Qualified.Should().Be(1);
        summary.Counseling.Scheduled.Should().Be(1);
        summary.Counseling.Completed.Should().Be(1);
        summary.Documents.Pending.Should().Be(1);
        summary.Documents.Verified.Should().Be(1);
    }
}
