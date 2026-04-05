using Microsoft.EntityFrameworkCore;
using University360.BuildingBlocks;

var builder = WebApplication.CreateBuilder(args);
builder.AddPlatformDefaults<OrganizationDbContext>();

var app = builder.Build();
app.UsePlatformDefaults();

await app.EnsureDatabaseReadyAsync<OrganizationDbContext>();
await SeedOrganizationDataAsync(app);

app.MapGet("/", () => Results.Ok(new { service = "organization-service", status = "ready", ownership = "colleges-campuses-programs" }));

app.MapGet("/api/v1/public/homepage", async (OrganizationDbContext dbContext, string tenantId = "default") =>
{
    var colleges = await dbContext.Colleges.Where(x => x.TenantId == tenantId).OrderBy(x => x.Name).ToListAsync();
    var campuses = await dbContext.Campuses.Where(x => x.TenantId == tenantId).OrderBy(x => x.Name).ToListAsync();
    var programs = await dbContext.Programs.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.IsFeatured).ThenBy(x => x.Name).ToListAsync();
    var departments = await dbContext.Departments.Where(x => x.TenantId == tenantId).ToListAsync();

    return Results.Ok(new
    {
        stats = new[]
        {
            new { label = "Colleges", value = colleges.Count.ToString("N0") },
            new { label = "Campuses", value = campuses.Count.ToString("N0") },
            new { label = "Programs", value = programs.Count.ToString("N0") },
            new { label = "Student Capacity", value = campuses.Sum(x => x.StudentCapacity).ToString("N0") }
        },
        colleges = colleges.Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.DeanName,
            x.City,
            x.CampusCount,
            x.StudentCount
        }),
        campuses = campuses.Select(x => new
        {
            x.Id,
            x.CollegeId,
            x.Code,
            x.Name,
            location = $"{x.City}, {x.State}",
            x.City,
            x.State,
            x.Description,
            image = x.ImagePath,
            statLabel = x.HighlightMetricLabel,
            statValue = x.HighlightMetricValue.ToString("N0"),
            x.StudentCapacity,
            x.FacultyCount,
            facilities = SplitList(x.Facilities)
        }),
        featuredPrograms = programs.Where(x => x.IsFeatured).Take(6).Select(x => new
        {
            x.Id,
            x.CampusId,
            x.Code,
            x.Name,
            x.LevelName,
            x.DepartmentName,
            x.DurationYears,
            x.Seats,
            mode = x.ModeName,
            x.Description,
            x.CareerPath
        }),
        departmentHighlights = departments
            .GroupBy(x => x.CollegeId)
            .Select(x => new { collegeId = x.Key, count = x.Count() }),
        campusOptions = campuses.Select(x => new { x.Id, x.Name }),
        levelOptions = programs.Select(x => x.LevelName).Distinct().OrderBy(x => x)
    });
});

app.MapGet("/api/v1/public/programs", async (OrganizationDbContext dbContext, string tenantId = "default", string? search = null, Guid? campusId = null, string? level = null) =>
{
    var query = dbContext.Programs.Where(x => x.TenantId == tenantId);

    if (campusId.HasValue)
    {
        query = query.Where(x => x.CampusId == campusId.Value);
    }

    if (!string.IsNullOrWhiteSpace(level))
    {
        query = query.Where(x => x.LevelName == level);
    }

    if (!string.IsNullOrWhiteSpace(search))
    {
        query = query.Where(x =>
            x.Name.Contains(search) ||
            x.Code.Contains(search) ||
            x.DepartmentName.Contains(search) ||
            x.Description.Contains(search) ||
            x.CareerPath.Contains(search));
    }

    var items = await query.OrderByDescending(x => x.IsFeatured).ThenBy(x => x.Name).Take(24).ToListAsync();
    return Results.Ok(items.Select(x => new
    {
        x.Id,
        x.CampusId,
        x.Code,
        x.Name,
        x.LevelName,
        x.DepartmentName,
        x.DurationYears,
        x.Seats,
        mode = x.ModeName,
        x.Description,
        x.CareerPath,
        x.IsFeatured
    }));
});

app.MapGet("/api/v1/catalog/summary", async (HttpContext httpContext, OrganizationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var colleges = await dbContext.Colleges.Where(x => x.TenantId == tenantId).ToListAsync();
    var campuses = await dbContext.Campuses.Where(x => x.TenantId == tenantId).ToListAsync();
    var programs = await dbContext.Programs.Where(x => x.TenantId == tenantId).ToListAsync();
    var departments = await dbContext.Departments.Where(x => x.TenantId == tenantId).ToListAsync();
    var staff = await dbContext.StaffDirectory.Where(x => x.TenantId == tenantId).ToListAsync();

    return Results.Ok(OrganizationCatalogMetrics.Create(colleges, campuses, programs, departments, staff));
}).RequirePermissions("results.view");

app.MapGet("/api/v1/colleges", async (HttpContext httpContext, OrganizationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var items = await dbContext.Colleges.Where(x => x.TenantId == tenantId).OrderBy(x => x.Name).ToListAsync();
    return Results.Ok(items);
}).RequirePermissions("results.view");

app.MapGet("/api/v1/campuses", async (HttpContext httpContext, OrganizationDbContext dbContext, Guid? collegeId) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var query = dbContext.Campuses.Where(x => x.TenantId == tenantId);
    if (collegeId.HasValue)
    {
        query = query.Where(x => x.CollegeId == collegeId.Value);
    }

    return Results.Ok(await query.OrderBy(x => x.Name).ToListAsync());
}).RequirePermissions("results.view");

app.MapGet("/api/v1/departments", async (HttpContext httpContext, OrganizationDbContext dbContext, Guid? campusId) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var query = dbContext.Departments.Where(x => x.TenantId == tenantId);
    if (campusId.HasValue)
    {
        query = query.Where(x => x.CampusId == campusId.Value);
    }

    return Results.Ok(await query.OrderBy(x => x.Name).ToListAsync());
}).RequirePermissions("results.view");

app.MapGet("/api/v1/hr/summary", async (HttpContext httpContext, OrganizationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var employees = await dbContext.Employees.Where(x => x.TenantId == tenantId).ToListAsync();
    var leaveRequests = await dbContext.LeaveRequests.Where(x => x.TenantId == tenantId).ToListAsync();
    var recruitmentOpenings = await dbContext.RecruitmentOpenings.Where(x => x.TenantId == tenantId).ToListAsync();
    var appraisals = await dbContext.AppraisalCycles.Where(x => x.TenantId == tenantId).ToListAsync();

    return Results.Ok(HumanResourcesSummary.Create(employees, leaveRequests, recruitmentOpenings, appraisals));
}).RequireRoles("Admin", "Principal", "HRManager", "HRStaff");

app.MapGet("/api/v1/hr/employees", async (HttpContext httpContext, OrganizationDbContext dbContext, string? department = null) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var query = dbContext.Employees.Where(x => x.TenantId == tenantId);

    if (!string.IsNullOrWhiteSpace(department))
    {
        query = query.Where(x => x.DepartmentName == department);
    }

    return Results.Ok(await query.OrderBy(x => x.FullName).ToListAsync());
}).RequireRoles("Admin", "Principal", "HRManager", "HRStaff");

app.MapGet("/api/v1/hr/leave-requests", async (HttpContext httpContext, OrganizationDbContext dbContext, int page = 1, int pageSize = 10) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 50);
    var query = dbContext.LeaveRequests.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.RequestedAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequireRoles("Admin", "Principal", "HRManager", "HRStaff");

app.MapPost("/api/v1/hr/leave-requests/{id:guid}/status", async (Guid id, HttpContext httpContext, UpdateLeaveRequestStatusRequest request, OrganizationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.LeaveRequests.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status;
    item.ApproverName = string.IsNullOrWhiteSpace(request.ApproverName) ? item.ApproverName : request.ApproverName.Trim();
    item.Comment = string.IsNullOrWhiteSpace(request.Comment) ? item.Comment : request.Comment.Trim();
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequireRoles("Admin", "Principal", "HRManager", "HRStaff");

app.MapGet("/api/v1/hr/recruitment/openings", async (HttpContext httpContext, OrganizationDbContext dbContext, int page = 1, int pageSize = 10) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 50);
    var query = dbContext.RecruitmentOpenings.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.PostedAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequireRoles("Admin", "Principal", "HRManager", "HRStaff");

app.MapPost("/api/v1/hr/recruitment/openings/{id:guid}/status", async (Guid id, HttpContext httpContext, UpdateRecruitmentOpeningStatusRequest request, OrganizationDbContext dbContext) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var item = await dbContext.RecruitmentOpenings.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id);
    if (item is null)
    {
        return Results.NotFound();
    }

    item.Status = request.Status;
    item.HiringManager = string.IsNullOrWhiteSpace(request.OwnerName) ? item.HiringManager : request.OwnerName.Trim();
    item.Note = string.IsNullOrWhiteSpace(request.Note) ? item.Note : request.Note.Trim();
    await dbContext.SaveChangesAsync();
    return Results.Ok(item);
}).RequireRoles("Admin", "Principal", "HRManager", "HRStaff");

app.MapGet("/api/v1/hr/appraisals", async (HttpContext httpContext, OrganizationDbContext dbContext, int page = 1, int pageSize = 10) =>
{
    var tenantId = httpContext.GetValidatedTenantId();
    var safePage = Math.Max(page, 1);
    var safePageSize = Math.Clamp(pageSize, 1, 50);
    var query = dbContext.AppraisalCycles.Where(x => x.TenantId == tenantId).OrderBy(x => x.DueAtUtc);
    var total = await query.CountAsync();
    var items = await query.Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync();
    return Results.Ok(new { page = safePage, pageSize = safePageSize, total, items });
}).RequireRoles("Admin", "Principal", "HRManager", "HRStaff");

app.Run();

static async Task SeedOrganizationDataAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();

    var engineeringCollegeId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    var liberalArtsCollegeId = Guid.Parse("10000000-0000-0000-0000-000000000002");
    var healthCollegeId = Guid.Parse("10000000-0000-0000-0000-000000000003");
    var northCampusId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    var heritageCampusId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    var healthCampusId = Guid.Parse("20000000-0000-0000-0000-000000000003");

    if (!await dbContext.Colleges.AnyAsync())
    {
        dbContext.Colleges.AddRange(
    [
        new CollegeProfile
        {
            Id = engineeringCollegeId,
            TenantId = "default",
            Code = "U360-ENG",
            Name = "School of Engineering and Digital Systems",
            DeanName = "Dr. Meera Nair",
            City = "Bengaluru",
            CampusCount = 1,
            StudentCount = 8200
        },
        new CollegeProfile
        {
            Id = liberalArtsCollegeId,
            TenantId = "default",
            Code = "U360-ARTS",
            Name = "College of Arts, Media, and Commerce",
            DeanName = "Dr. Arjun Patel",
            City = "Mysuru",
            CampusCount = 1,
            StudentCount = 5400
        },
        new CollegeProfile
        {
            Id = healthCollegeId,
            TenantId = "default",
            Code = "U360-HLTH",
            Name = "Institute of Health and Applied Sciences",
            DeanName = "Dr. Kavya Iyer",
            City = "Chennai",
            CampusCount = 1,
            StudentCount = 4300
        }
    ]);
    }

    if (!await dbContext.Campuses.AnyAsync())
    {
        dbContext.Campuses.AddRange(
    [
        new CampusProfile
        {
            Id = northCampusId,
            TenantId = "default",
            CollegeId = engineeringCollegeId,
            Code = "BLR-NORTH",
            Name = "North City Campus",
            City = "Bengaluru",
            State = "Karnataka",
            Description = "A technology-led campus with applied AI labs, startup incubation support, and strong industry-linked engineering delivery.",
            ImagePath = "/images/graduation-hero.svg",
            StudentCapacity = 6200,
            FacultyCount = 340,
            HighlightMetricLabel = "Live Labs",
            HighlightMetricValue = 19,
            Facilities = "Innovation hub,Cloud lab,Maker space,Startup cell"
        },
        new CampusProfile
        {
            Id = heritageCampusId,
            TenantId = "default",
            CollegeId = liberalArtsCollegeId,
            Code = "MYS-HERITAGE",
            Name = "Heritage Arts Campus",
            City = "Mysuru",
            State = "Karnataka",
            Description = "Designed for liberal arts, commerce, media, and interdisciplinary collaboration with a calmer academic atmosphere and strong cultural programming.",
            ImagePath = "/images/student-spotlight.svg",
            StudentCapacity = 4100,
            FacultyCount = 210,
            HighlightMetricLabel = "Studios",
            HighlightMetricValue = 11,
            Facilities = "Media studio,Design workshop,Library commons,Language lab"
        },
        new CampusProfile
        {
            Id = healthCampusId,
            TenantId = "default",
            CollegeId = healthCollegeId,
            Code = "CHE-HEALTH",
            Name = "Health Sciences Campus",
            City = "Chennai",
            State = "Tamil Nadu",
            Description = "A simulation-ready campus for allied health, biosciences, and community practice with clinical readiness spaces.",
            ImagePath = "/images/graduation-hero.svg",
            StudentCapacity = 3600,
            FacultyCount = 185,
            HighlightMetricLabel = "Clinical Suites",
            HighlightMetricValue = 8,
            Facilities = "Simulation ward,Anatomy lab,Community clinic,Research wet lab"
        }
    ]);
    }

    if (!await dbContext.Departments.AnyAsync())
    {
        dbContext.Departments.AddRange(
    [
        new DepartmentProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = engineeringCollegeId,
            CampusId = northCampusId,
            Name = "Computer Science",
            ChairName = "Dr. Priya Menon",
            ProgramCount = 2
        },
        new DepartmentProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = liberalArtsCollegeId,
            CampusId = heritageCampusId,
            Name = "Management Studies",
            ChairName = "Dr. Harish Kannan",
            ProgramCount = 1
        },
        new DepartmentProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = liberalArtsCollegeId,
            CampusId = heritageCampusId,
            Name = "Media Studies",
            ChairName = "Dr. Sahana Joseph",
            ProgramCount = 1
        },
        new DepartmentProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = healthCollegeId,
            CampusId = healthCampusId,
            Name = "Allied Health",
            ChairName = "Dr. Nikhil Rajan",
            ProgramCount = 1
        },
        new DepartmentProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = healthCollegeId,
            CampusId = healthCampusId,
            Name = "Biosciences",
            ChairName = "Dr. Asha Varma",
            ProgramCount = 1
        }
    ]);
    }

    if (!await dbContext.StaffDirectory.AnyAsync())
    {
        dbContext.StaffDirectory.AddRange(
    [
        new StaffDirectoryEntry
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = engineeringCollegeId,
            CampusId = northCampusId,
            DepartmentName = "Computer Science",
            FullName = "Prof. Rohan Iyer",
            RoleName = "Professor",
            Email = "rohan.iyer@university360.edu"
        },
        new StaffDirectoryEntry
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = liberalArtsCollegeId,
            CampusId = heritageCampusId,
            DepartmentName = "Media Studies",
            FullName = "Prof. Aditi Bose",
            RoleName = "Professor",
            Email = "aditi.bose@university360.edu"
        },
        new StaffDirectoryEntry
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CollegeId = healthCollegeId,
            CampusId = healthCampusId,
            DepartmentName = "Allied Health",
            FullName = "Prof. Kiran Thomas",
            RoleName = "Professor",
            Email = "kiran.thomas@university360.edu"
        }
    ]);
    }

    if (!await dbContext.Programs.AnyAsync())
    {
        dbContext.Programs.AddRange(
    [
        new AcademicProgramProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CampusId = northCampusId,
            Code = "BTECH-CSE",
            Name = "B.Tech Computer Science and Engineering",
            LevelName = "Undergraduate",
            DepartmentName = "Computer Science",
            DurationYears = 4,
            Seats = 240,
            ModeName = "Full Time",
            IsFeatured = true,
            Description = "A project-heavy engineering pathway focused on software delivery, distributed systems, and AI fundamentals.",
            CareerPath = "Software engineering, cloud, platform, and AI product teams"
        },
        new AcademicProgramProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CampusId = northCampusId,
            Code = "MTECH-DS",
            Name = "M.Tech Data Science",
            LevelName = "Postgraduate",
            DepartmentName = "Data Science",
            DurationYears = 2,
            Seats = 60,
            ModeName = "Full Time",
            IsFeatured = true,
            Description = "Advanced analytics, applied machine learning, and production data engineering with an industry project studio.",
            CareerPath = "Data science, MLOps, research, analytics leadership"
        },
        new AcademicProgramProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CampusId = heritageCampusId,
            Code = "BBA-DM",
            Name = "BBA Digital Management",
            LevelName = "Undergraduate",
            DepartmentName = "Management Studies",
            DurationYears = 3,
            Seats = 180,
            ModeName = "Full Time",
            IsFeatured = true,
            Description = "Business fundamentals, digital operations, and communication design for modern enterprise teams.",
            CareerPath = "Operations, product support, digital business, consulting"
        },
        new AcademicProgramProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CampusId = heritageCampusId,
            Code = "BA-MEDIA",
            Name = "BA Media and Communication",
            LevelName = "Undergraduate",
            DepartmentName = "Media Studies",
            DurationYears = 3,
            Seats = 120,
            ModeName = "Full Time",
            IsFeatured = false,
            Description = "Editorial storytelling, campus production, and digital publishing grounded in applied communication practice.",
            CareerPath = "Content, media production, communication strategy"
        },
        new AcademicProgramProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CampusId = healthCampusId,
            Code = "BSC-ALLIED",
            Name = "B.Sc Allied Health Sciences",
            LevelName = "Undergraduate",
            DepartmentName = "Allied Health",
            DurationYears = 4,
            Seats = 150,
            ModeName = "Full Time",
            IsFeatured = true,
            Description = "Clinical readiness, diagnostics, and community health practice supported by simulation-led instruction.",
            CareerPath = "Hospitals, diagnostics, community health, clinical support"
        },
        new AcademicProgramProfile
        {
            Id = Guid.NewGuid(),
            TenantId = "default",
            CampusId = healthCampusId,
            Code = "MSC-BIO",
            Name = "M.Sc Biosciences",
            LevelName = "Postgraduate",
            DepartmentName = "Biosciences",
            DurationYears = 2,
            Seats = 48,
            ModeName = "Full Time",
            IsFeatured = false,
            Description = "Research-led bioscience study with translational lab work and faculty-supervised capstone projects.",
            CareerPath = "Research labs, biotech, higher studies"
        }
    ]);
    }

    if (!await dbContext.Employees.AnyAsync())
    {
        dbContext.Employees.AddRange(
        [
            new EmployeeProfile
            {
                Id = Guid.Parse("40000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                CampusId = northCampusId,
                EmployeeCode = "EMP-1001",
                FullName = "Rhea Kapoor",
                DepartmentName = "Computer Science",
                Title = "Assistant Professor",
                EmploymentType = "Faculty",
                Status = "Active",
                OnboardingStatus = "Completed",
                ManagerName = "Dr. Priya Menon",
                JoiningDateUtc = DateTimeOffset.UtcNow.AddYears(-2)
            },
            new EmployeeProfile
            {
                Id = Guid.Parse("40000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                CampusId = heritageCampusId,
                EmployeeCode = "EMP-1002",
                FullName = "Nikhil Batra",
                DepartmentName = "Finance Office",
                Title = "Accounts Officer",
                EmploymentType = "Staff",
                Status = "Active",
                OnboardingStatus = "In Progress",
                ManagerName = "Sonal Verma",
                JoiningDateUtc = DateTimeOffset.UtcNow.AddDays(-12)
            },
            new EmployeeProfile
            {
                Id = Guid.Parse("40000000-0000-0000-0000-000000000003"),
                TenantId = "default",
                CampusId = healthCampusId,
                EmployeeCode = "EMP-1003",
                FullName = "Farah Thomas",
                DepartmentName = "Admissions",
                Title = "Counselor",
                EmploymentType = "Staff",
                Status = "Active",
                OnboardingStatus = "Completed",
                ManagerName = "Rahul George",
                JoiningDateUtc = DateTimeOffset.UtcNow.AddMonths(-8)
            }
        ]);
    }

    if (!await dbContext.LeaveRequests.AnyAsync())
    {
        dbContext.LeaveRequests.AddRange(
        [
            new LeaveRequest
            {
                Id = Guid.Parse("41000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                EmployeeId = Guid.Parse("40000000-0000-0000-0000-000000000001"),
                EmployeeName = "Rhea Kapoor",
                LeaveType = "Conference Leave",
                Status = "Pending Approval",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
                StartDateUtc = DateTimeOffset.UtcNow.AddDays(6),
                EndDateUtc = DateTimeOffset.UtcNow.AddDays(8),
                ApproverName = "Dr. Priya Menon"
            },
            new LeaveRequest
            {
                Id = Guid.Parse("41000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                EmployeeId = Guid.Parse("40000000-0000-0000-0000-000000000003"),
                EmployeeName = "Farah Thomas",
                LeaveType = "Casual Leave",
                Status = "Approved",
                RequestedAtUtc = DateTimeOffset.UtcNow.AddDays(-4),
                StartDateUtc = DateTimeOffset.UtcNow.AddDays(2),
                EndDateUtc = DateTimeOffset.UtcNow.AddDays(3),
                ApproverName = "Rahul George",
                Comment = "Coverage aligned with counseling desk roster."
            }
        ]);
    }

    if (!await dbContext.RecruitmentOpenings.AnyAsync())
    {
        dbContext.RecruitmentOpenings.AddRange(
        [
            new RecruitmentOpening
            {
                Id = Guid.Parse("42000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                CampusId = northCampusId,
                Title = "Associate Professor - AI Systems",
                DepartmentName = "Computer Science",
                Status = "Interviewing",
                OpenPositions = 2,
                CandidatePipelineCount = 11,
                HiringManager = "Dr. Priya Menon",
                PostedAtUtc = DateTimeOffset.UtcNow.AddDays(-18),
                Note = "Panel rounds scheduled this week."
            },
            new RecruitmentOpening
            {
                Id = Guid.Parse("42000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                CampusId = heritageCampusId,
                Title = "Hostel Operations Supervisor",
                DepartmentName = "Campus Services",
                Status = "Open",
                OpenPositions = 1,
                CandidatePipelineCount = 5,
                HiringManager = "Madhav Iyer",
                PostedAtUtc = DateTimeOffset.UtcNow.AddDays(-8),
                Note = "Shortlisting underway for wardenship experience."
            }
        ]);
    }

    if (!await dbContext.AppraisalCycles.AnyAsync())
    {
        dbContext.AppraisalCycles.AddRange(
        [
            new AppraisalCycle
            {
                Id = Guid.Parse("43000000-0000-0000-0000-000000000001"),
                TenantId = "default",
                EmployeeId = Guid.Parse("40000000-0000-0000-0000-000000000001"),
                EmployeeName = "Rhea Kapoor",
                CycleName = "FY26 Mid-Year Review",
                Status = "Self Review Submitted",
                DueAtUtc = DateTimeOffset.UtcNow.AddDays(4),
                Score = 4.2m
            },
            new AppraisalCycle
            {
                Id = Guid.Parse("43000000-0000-0000-0000-000000000002"),
                TenantId = "default",
                EmployeeId = Guid.Parse("40000000-0000-0000-0000-000000000003"),
                EmployeeName = "Farah Thomas",
                CycleName = "FY26 Mid-Year Review",
                Status = "Manager Review Pending",
                DueAtUtc = DateTimeOffset.UtcNow.AddDays(-1),
                Score = 0m
            }
        ]);
    }

    await dbContext.SaveChangesAsync();
}

static string[] SplitList(string value) =>
    value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

public static class OrganizationCatalogMetrics
{
    public static OrganizationCatalogSummary Create(
        IReadOnlyCollection<CollegeProfile> colleges,
        IReadOnlyCollection<CampusProfile> campuses,
        IReadOnlyCollection<AcademicProgramProfile> programs,
        IReadOnlyCollection<DepartmentProfile> departments,
        IReadOnlyCollection<StaffDirectoryEntry> staff) =>
        new(
            colleges.Count,
            campuses.Count,
            programs.Count,
            departments.Count,
            campuses.Sum(x => x.FacultyCount),
            campuses.Sum(x => x.StudentCapacity),
            programs.Count(x => x.IsFeatured),
            staff.Count);
}

public static class HumanResourcesSummary
{
    public static HumanResourcesSnapshot Create(
        IReadOnlyCollection<EmployeeProfile> employees,
        IReadOnlyCollection<LeaveRequest> leaveRequests,
        IReadOnlyCollection<RecruitmentOpening> recruitmentOpenings,
        IReadOnlyCollection<AppraisalCycle> appraisals)
    {
        var activeEmployees = employees.Count(x => string.Equals(x.Status, "Active", StringComparison.OrdinalIgnoreCase));
        var onboarding = employees.Count(x => !string.Equals(x.OnboardingStatus, "Completed", StringComparison.OrdinalIgnoreCase));
        var pendingLeave = leaveRequests.Count(x => x.Status.Contains("Pending", StringComparison.OrdinalIgnoreCase));
        var openRecruitment = recruitmentOpenings.Count(x => !string.Equals(x.Status, "Closed", StringComparison.OrdinalIgnoreCase) && !string.Equals(x.Status, "Filled", StringComparison.OrdinalIgnoreCase));
        var dueAppraisals = appraisals.Count(x => !string.Equals(x.Status, "Completed", StringComparison.OrdinalIgnoreCase) && x.DueAtUtc <= DateTimeOffset.UtcNow.AddDays(7));
        var completedAppraisals = appraisals.Count(x => string.Equals(x.Status, "Completed", StringComparison.OrdinalIgnoreCase));

        return new HumanResourcesSnapshot(activeEmployees, onboarding, pendingLeave, openRecruitment, dueAppraisals, completedAppraisals);
    }
}

public sealed record OrganizationCatalogSummary(
    int Colleges,
    int Campuses,
    int Programs,
    int Departments,
    int FacultyCount,
    int StudentCapacity,
    int FeaturedPrograms,
    int StaffDirectoryEntries);

public sealed record HumanResourcesSnapshot(
    int ActiveEmployees,
    int OnboardingInProgress,
    int PendingLeaveRequests,
    int OpenRecruitment,
    int AppraisalsDueSoon,
    int CompletedAppraisals);

public sealed record UpdateLeaveRequestStatusRequest(string Status, string? ApproverName, string? Comment);

public sealed record UpdateRecruitmentOpeningStatusRequest(string Status, string? OwnerName, string? Note);

public sealed class CollegeProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string DeanName { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public int CampusCount { get; set; }
    public int StudentCount { get; set; }
}

public sealed class CampusProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CollegeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ImagePath { get; set; } = "/images/graduation-hero.svg";
    public int StudentCapacity { get; set; }
    public int FacultyCount { get; set; }
    public string HighlightMetricLabel { get; set; } = "Programs";
    public int HighlightMetricValue { get; set; }
    public string Facilities { get; set; } = string.Empty;
}

public sealed class DepartmentProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CollegeId { get; set; }
    public Guid CampusId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ChairName { get; set; } = string.Empty;
    public int ProgramCount { get; set; }
}

public sealed class StaffDirectoryEntry
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CollegeId { get; set; }
    public Guid CampusId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public sealed class EmployeeProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CampusId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string EmploymentType { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public string OnboardingStatus { get; set; } = "Completed";
    public string ManagerName { get; set; } = string.Empty;
    public DateTimeOffset JoiningDateUtc { get; set; }
}

public sealed class LeaveRequest
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string LeaveType { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending Approval";
    public DateTimeOffset RequestedAtUtc { get; set; }
    public DateTimeOffset StartDateUtc { get; set; }
    public DateTimeOffset EndDateUtc { get; set; }
    public string ApproverName { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
}

public sealed class RecruitmentOpening
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CampusId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string Status { get; set; } = "Open";
    public int OpenPositions { get; set; }
    public int CandidatePipelineCount { get; set; }
    public string HiringManager { get; set; } = string.Empty;
    public DateTimeOffset PostedAtUtc { get; set; }
    public string Note { get; set; } = string.Empty;
}

public sealed class AppraisalCycle
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string CycleName { get; set; } = string.Empty;
    public string Status { get; set; } = "Planned";
    public DateTimeOffset DueAtUtc { get; set; }
    public decimal Score { get; set; }
}

public sealed class AcademicProgramProfile
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = "default";
    public Guid CampusId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string LevelName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public int DurationYears { get; set; }
    public int Seats { get; set; }
    public string ModeName { get; set; } = "Full Time";
    public bool IsFeatured { get; set; }
    public string Description { get; set; } = string.Empty;
    public string CareerPath { get; set; } = string.Empty;
}

public sealed class OrganizationDbContext(DbContextOptions<OrganizationDbContext> options) : DbContext(options)
{
    public DbSet<CollegeProfile> Colleges => Set<CollegeProfile>();
    public DbSet<CampusProfile> Campuses => Set<CampusProfile>();
    public DbSet<DepartmentProfile> Departments => Set<DepartmentProfile>();
    public DbSet<StaffDirectoryEntry> StaffDirectory => Set<StaffDirectoryEntry>();
    public DbSet<AcademicProgramProfile> Programs => Set<AcademicProgramProfile>();
    public DbSet<EmployeeProfile> Employees => Set<EmployeeProfile>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<RecruitmentOpening> RecruitmentOpenings => Set<RecruitmentOpening>();
    public DbSet<AppraisalCycle> AppraisalCycles => Set<AppraisalCycle>();
}
