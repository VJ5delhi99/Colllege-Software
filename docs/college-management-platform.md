# College Management Platform Blueprint

## 1. Product Scope

University360 evolves into a multi-tenant College Management Platform where a single university governs multiple colleges, each college owns multiple campuses, and every campus operates academic, people, communication, and student-success workflows from one platform.

### Primary personas

- Super Admin: university-wide governance, cross-college reporting, tenancy setup
- College Admin: college operations, staffing, curriculum, announcements, compliance
- Campus Admin: campus scheduling, departments, admissions, day-to-day coordination
- Teacher: classes, assignments, attendance, grading, announcements
- Student: enrollment, timetable, assignments, results, notifications, profile
- Guest: public browsing, admissions questions, course discovery, contact support

## 2. Target Architecture

### Experience layer

- Public web experience: admissions homepage, course discovery, campus highlights, guest chatbot
- Admin web experience: governance, analytics, role management, operational dashboards
- Mobile app: student and teacher workflows with the same design language and API contracts

### Backend platform

- API gateway: routing, throttling, auth propagation, API version fan-out
- Identity service: JWT issuance, refresh tokens, OTP, email verification, password reset
- Authorization service: RBAC, permission catalog, policy mapping
- Organization service: university, college, campus, department, staff structure
- Academic service: courses, programs, sections, enrollment, timetable
- Communication service: announcements, notifications, ticker content
- Assessment service: assignments, submissions, grades, results
- Files service: uploads, media, assignment attachments, campus gallery
- Audit and analytics pipeline: event capture, observability, reporting

### Architectural style

- .NET 9 backend with Clean Architecture boundaries inside each domain service
- SQL Server as the operational system of record
- REST APIs with API versioning and predictable envelope/error contracts
- Event-driven integration for notifications, analytics, and audit fan-out
- Multi-tenancy ready from day one through tenant and scope identifiers

## 3. Clean Architecture Layout (.NET 9)

Recommended structure for each core service:

```text
/services/organization-service
  /src
    /OrganizationService.Domain
      Entities/
      ValueObjects/
      Enums/
      Events/
      Repositories/
    /OrganizationService.Application
      Abstractions/
      Commands/
      Queries/
      DTOs/
      Validators/
      Behaviors/
    /OrganizationService.Infrastructure
      Persistence/
      Configurations/
      Repositories/
      Identity/
      Messaging/
    /OrganizationService.Api
      Controllers/
      Contracts/
      Middleware/
      Filters/
      DependencyInjection/
  /tests
    /OrganizationService.UnitTests
    /OrganizationService.IntegrationTests
```

### Cross-cutting concerns

- EF Core with SQL Server provider
- Repository pattern only at aggregate boundaries
- Unit of Work via DbContext transaction boundary
- FluentValidation for command validation
- Serilog for structured logs
- Global exception middleware returning RFC7807-style problem details
- OpenTelemetry tracing and metrics
- API versioning by URL: `/api/v1/...`

## 4. Domain Model

### Core hierarchy

- University
- College
- Campus
- Department
- Program
- Course
- CourseOffering
- Student
- Teacher
- Staff

### Supporting aggregates

- UserAccount
- Role
- Permission
- UserRole
- Announcement
- Notification
- Enrollment
- AttendanceRecord
- Assignment
- Submission
- Result
- FileAsset
- AuditLog

### Multi-tenancy model

- `TenantId` represents the university tenant boundary
- `CollegeId` and `CampusId` support scoped filtering for delegated admins
- every business table includes `TenantId`
- every mutable table includes audit columns and `IsDeleted`

## 5. Database Design

The normalized SQL Server schema lives in [college-management-schema.sql](/c:/Users/user/Documents/GitHub/Colllege-Software/docs/database/college-management-schema.sql). It includes:

- normalized organization hierarchy
- user and RBAC tables
- academic delivery tables
- announcements and notifications
- audit logs and file assets
- filtered indexes for soft delete
- row-version columns for optimistic concurrency

### Key design decisions

- separate `People` from role-specific tables like `Students`, `Teachers`, and `StaffMembers`
- separate `Programs`, `Courses`, and `CourseOfferings` to avoid timetable duplication
- separate `AcademicTerms` and `Sections` so campuses can run multiple terms and cohorts
- use join tables for user-role and role-permission assignments
- keep announcements and notifications distinct because publication and delivery are different concerns

## 6. Permission Matrix

| Permission | Super Admin | College Admin | Campus Admin | Teacher | Student | Guest |
|---|---|---|---|---|---|---|
| `university.manage` | Yes | No | No | No | No | No |
| `college.manage` | Yes | Yes | No | No | No | No |
| `campus.manage` | Yes | Yes | Yes | No | No | No |
| `department.manage` | Yes | Yes | Yes | No | No | No |
| `user.manage` | Yes | Yes | Yes | No | No | No |
| `course.manage` | Yes | Yes | Yes | No | No | No |
| `course.teach` | No | No | No | Yes | No | No |
| `attendance.mark` | No | No | No | Yes | No | No |
| `assignment.manage` | No | No | No | Yes | No | No |
| `assignment.submit` | No | No | No | No | Yes | No |
| `result.publish` | Yes | Yes | Yes | Yes | No | No |
| `result.view` | Yes | Yes | Yes | Yes | Yes | No |
| `announcement.publish` | Yes | Yes | Yes | Yes | No | No |
| `notification.view` | Yes | Yes | Yes | Yes | Yes | No |
| `public.chat` | Yes | Yes | Yes | Yes | Yes | Yes |

## 7. API Surface

### Identity and auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/confirm`
- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/email-verification/send`
- `POST /api/v1/auth/email-verification/confirm`

### Organization management

- `GET /api/v1/universities`
- `POST /api/v1/universities`
- `GET /api/v1/colleges`
- `POST /api/v1/colleges`
- `GET /api/v1/campuses`
- `POST /api/v1/campuses`
- `GET /api/v1/departments`
- `POST /api/v1/departments`
- `GET /api/v1/staff`
- `POST /api/v1/staff`
- `GET /api/v1/teachers`
- `POST /api/v1/teachers`
- `GET /api/v1/students`
- `POST /api/v1/students`

### Academics

- `GET /api/v1/programs`
- `POST /api/v1/programs`
- `GET /api/v1/courses`
- `POST /api/v1/courses`
- `GET /api/v1/course-offerings`
- `POST /api/v1/course-offerings`
- `POST /api/v1/enrollments`
- `GET /api/v1/timetables/student/{studentId}`
- `GET /api/v1/timetables/teacher/{teacherId}`

### Teaching and assessment

- `GET /api/v1/assignments`
- `POST /api/v1/assignments`
- `POST /api/v1/submissions`
- `POST /api/v1/attendance/sessions`
- `POST /api/v1/attendance/records`
- `POST /api/v1/results`
- `GET /api/v1/results/student/{studentId}`

### Communication and public content

- `GET /api/v1/announcements`
- `POST /api/v1/announcements`
- `GET /api/v1/homepage`
- `GET /api/v1/homepage/ticker`
- `GET /api/v1/campuses/highlights`
- `POST /api/v1/chat/public`
- `POST /api/v1/chat/authenticated`

### Admin and platform

- `GET /api/v1/dashboard/super-admin`
- `GET /api/v1/dashboard/college-admin`
- `GET /api/v1/dashboard/campus-admin`
- `GET /api/v1/dashboard/teacher`
- `GET /api/v1/dashboard/student`
- `GET /api/v1/audit-logs`
- `POST /api/v1/files/presign`

## 8. UI/UX Blueprint

### Homepage

- top navigation with clear public IA
- scrolling announcement ticker for urgency and freshness
- editorial hero section with direct CTAs
- quick role entry cards for student, teacher, and staff access
- announcement cards with date, tag, and CTA
- campus highlights with rich visuals and differentiators
- floating chatbot for admissions and contact help
- footer with trust, support, and policy links

### Dashboard patterns

- summary hero with role-specific status
- card-based KPIs
- action panels for next-step tasks
- clear empty states and recovery guidance
- responsive side navigation or top tabs based on screen width

### Design system guidance

- use semantic tokens for color, spacing, radius, type scale, and elevation
- preserve AA contrast at minimum
- support touch targets of at least 44x44 px
- provide skeleton/loading states for every async region
- make forms explicit with inline validation and success confirmation

## 9. Mobile App Structure (React Native)

```text
/mobile-app
  /app
    /(public)
    /(auth)
    /(student)
    /(teacher)
    /(admin)
  /components
    /ui
    /cards
    /forms
    /charts
  /features
    /auth
    /announcements
    /courses
    /attendance
    /results
    /chatbot
  /services
    api/
    storage/
  /store
    auth-store.ts
    notification-store.ts
```

### State management

- Zustand for auth, session context, and lightweight UI state
- React Query for server data caching, pagination, and mutation handling
- schema-based form validation using Zod or Yup

## 10. Critical Module Samples

### Example aggregate root

```csharp
public sealed class Campus : AuditableEntity
{
    private readonly List<Department> _departments = [];

    public Guid CollegeId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public string City { get; private set; } = string.Empty;
    public string State { get; private set; } = string.Empty;

    public IReadOnlyCollection<Department> Departments => _departments;

    public static Campus Create(Guid tenantId, Guid collegeId, string name, string code, string city, string state)
    {
        return new Campus
        {
            TenantId = tenantId,
            CollegeId = collegeId,
            Name = name.Trim(),
            Code = code.Trim().ToUpperInvariant(),
            City = city.Trim(),
            State = state.Trim()
        };
    }
}
```

### Example application command

```csharp
public sealed record CreateCampusCommand(
    Guid TenantId,
    Guid CollegeId,
    string Name,
    string Code,
    string City,
    string State) : IRequest<Guid>;
```

### Example API contract

```csharp
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/campuses")]
public sealed class CampusesController : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = "campus.manage")]
    public async Task<IActionResult> Create(
        [FromBody] CreateCampusRequest request,
        CancellationToken cancellationToken)
    {
        var id = await _mediator.Send(request.ToCommand(), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id, version = "1" }, new { id });
    }
}
```

## 11. QA Strategy

The detailed QA pack lives in [college-management-test-cases.md](/c:/Users/user/Documents/GitHub/Colllege-Software/docs/qa/college-management-test-cases.md).

### Coverage priorities

- positive and negative API validation
- RBAC matrix enforcement
- tenant and scope isolation
- empty states and degraded service handling
- OTP, reset, and verification edge cases
- file upload constraints
- pagination, filtering, and search correctness
- accessibility smoke checks on public and authenticated experiences

## 12. Delivery Roadmap

### Phase 1

- public homepage
- identity and RBAC hardening
- university, college, campus, department master data
- student and teacher dashboard foundation

### Phase 2

- assignments, attendance, results, notifications
- file uploads
- audit log viewer
- analytics and search

### Phase 3

- admissions workflow
- payment integration
- advanced chatbot orchestration
- SSO and external notification providers
