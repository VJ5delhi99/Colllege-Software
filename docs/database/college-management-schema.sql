CREATE TABLE dbo.Universities (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(32) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    ShortName NVARCHAR(100) NULL,
    WebsiteUrl NVARCHAR(300) NULL,
    Email NVARCHAR(256) NULL,
    PhoneNumber NVARCHAR(32) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Universities_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Universities_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT UQ_Universities_Tenant_Code UNIQUE (TenantId, Code)
);

CREATE TABLE dbo.Colleges (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UniversityId UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(32) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    DeanName NVARCHAR(150) NULL,
    Email NVARCHAR(256) NULL,
    PhoneNumber NVARCHAR(32) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Colleges_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Colleges_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Colleges_Universities FOREIGN KEY (UniversityId) REFERENCES dbo.Universities(Id),
    CONSTRAINT UQ_Colleges_Tenant_Code UNIQUE (TenantId, Code)
);

CREATE TABLE dbo.Campuses (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CollegeId UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(32) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    City NVARCHAR(100) NOT NULL,
    StateName NVARCHAR(100) NOT NULL,
    AddressLine1 NVARCHAR(200) NULL,
    AddressLine2 NVARCHAR(200) NULL,
    PostalCode NVARCHAR(20) NULL,
    Latitude DECIMAL(9, 6) NULL,
    Longitude DECIMAL(9, 6) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Campuses_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Campuses_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Campuses_Colleges FOREIGN KEY (CollegeId) REFERENCES dbo.Colleges(Id),
    CONSTRAINT UQ_Campuses_Tenant_Code UNIQUE (TenantId, Code)
);

CREATE TABLE dbo.Departments (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CampusId UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(32) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    HODName NVARCHAR(150) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Departments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Departments_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Departments_Campuses FOREIGN KEY (CampusId) REFERENCES dbo.Campuses(Id),
    CONSTRAINT UQ_Departments_Tenant_Campus_Code UNIQUE (TenantId, CampusId, Code)
);

CREATE TABLE dbo.Programs (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    DepartmentId UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(32) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    LevelName NVARCHAR(50) NOT NULL,
    DurationInYears INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Programs_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Programs_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Programs_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(Id),
    CONSTRAINT UQ_Programs_Tenant_Department_Code UNIQUE (TenantId, DepartmentId, Code)
);

CREATE TABLE dbo.People (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CampusId UNIQUEIDENTIFIER NOT NULL,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(256) NOT NULL,
    PhoneNumber NVARCHAR(32) NULL,
    Gender NVARCHAR(20) NULL,
    DateOfBirth DATE NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_People_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_People_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_People_Campuses FOREIGN KEY (CampusId) REFERENCES dbo.Campuses(Id),
    CONSTRAINT UQ_People_Tenant_Email UNIQUE (TenantId, Email)
);

CREATE TABLE dbo.UserAccounts (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PersonId UNIQUEIDENTIFIER NOT NULL,
    Username NVARCHAR(100) NOT NULL,
    PasswordHash NVARCHAR(500) NOT NULL,
    PasswordSalt NVARCHAR(200) NULL,
    IsEmailVerified BIT NOT NULL CONSTRAINT DF_UserAccounts_IsEmailVerified DEFAULT 0,
    IsLocked BIT NOT NULL CONSTRAINT DF_UserAccounts_IsLocked DEFAULT 0,
    LastLoginAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UserAccounts_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_UserAccounts_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_UserAccounts_People FOREIGN KEY (PersonId) REFERENCES dbo.People(Id),
    CONSTRAINT UQ_UserAccounts_Tenant_Username UNIQUE (TenantId, Username)
);

CREATE TABLE dbo.Roles (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    ScopeLevel NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Roles_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT UQ_Roles_Tenant_Name UNIQUE (TenantId, Name)
);

CREATE TABLE dbo.Permissions (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Code NVARCHAR(100) NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    Description NVARCHAR(300) NULL,
    CONSTRAINT UQ_Permissions_Code UNIQUE (Code)
);

CREATE TABLE dbo.RolePermissions (
    RoleId UNIQUEIDENTIFIER NOT NULL,
    PermissionId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(Id)
);

CREATE TABLE dbo.UserRoles (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserAccountId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    CollegeId UNIQUEIDENTIFIER NULL,
    CampusId UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UserRoles_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_UserRoles_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_UserRoles_UserAccounts FOREIGN KEY (UserAccountId) REFERENCES dbo.UserAccounts(Id),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_UserRoles_Colleges FOREIGN KEY (CollegeId) REFERENCES dbo.Colleges(Id),
    CONSTRAINT FK_UserRoles_Campuses FOREIGN KEY (CampusId) REFERENCES dbo.Campuses(Id)
);

CREATE TABLE dbo.Teachers (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PersonId UNIQUEIDENTIFIER NOT NULL,
    DepartmentId UNIQUEIDENTIFIER NOT NULL,
    EmployeeNumber NVARCHAR(50) NOT NULL,
    HireDate DATE NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Teachers_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Teachers_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Teachers_People FOREIGN KEY (PersonId) REFERENCES dbo.People(Id),
    CONSTRAINT FK_Teachers_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(Id),
    CONSTRAINT UQ_Teachers_Tenant_EmployeeNumber UNIQUE (TenantId, EmployeeNumber)
);

CREATE TABLE dbo.StaffMembers (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PersonId UNIQUEIDENTIFIER NOT NULL,
    DepartmentId UNIQUEIDENTIFIER NULL,
    EmployeeNumber NVARCHAR(50) NOT NULL,
    JobTitle NVARCHAR(120) NOT NULL,
    HireDate DATE NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_StaffMembers_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_StaffMembers_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_StaffMembers_People FOREIGN KEY (PersonId) REFERENCES dbo.People(Id),
    CONSTRAINT FK_StaffMembers_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(Id),
    CONSTRAINT UQ_StaffMembers_Tenant_EmployeeNumber UNIQUE (TenantId, EmployeeNumber)
);

CREATE TABLE dbo.Students (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    PersonId UNIQUEIDENTIFIER NOT NULL,
    ProgramId UNIQUEIDENTIFIER NOT NULL,
    StudentNumber NVARCHAR(50) NOT NULL,
    AdmissionDate DATE NOT NULL,
    CurrentSemester INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Students_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Students_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Students_People FOREIGN KEY (PersonId) REFERENCES dbo.People(Id),
    CONSTRAINT FK_Students_Programs FOREIGN KEY (ProgramId) REFERENCES dbo.Programs(Id),
    CONSTRAINT UQ_Students_Tenant_StudentNumber UNIQUE (TenantId, StudentNumber)
);

CREATE TABLE dbo.AcademicTerms (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CampusId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    TermType NVARCHAR(50) NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    IsCurrent BIT NOT NULL CONSTRAINT DF_AcademicTerms_IsCurrent DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AcademicTerms_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AcademicTerms_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_AcademicTerms_Campuses FOREIGN KEY (CampusId) REFERENCES dbo.Campuses(Id)
);

CREATE TABLE dbo.Courses (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    DepartmentId UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(32) NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Credits INT NOT NULL,
    Description NVARCHAR(1000) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Courses_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Courses_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Courses_Departments FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(Id),
    CONSTRAINT UQ_Courses_Tenant_Department_Code UNIQUE (TenantId, DepartmentId, Code)
);

CREATE TABLE dbo.Sections (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    ProgramId UNIQUEIDENTIFIER NOT NULL,
    AcademicTermId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(50) NOT NULL,
    SemesterNumber INT NOT NULL,
    Capacity INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Sections_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Sections_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Sections_Programs FOREIGN KEY (ProgramId) REFERENCES dbo.Programs(Id),
    CONSTRAINT FK_Sections_AcademicTerms FOREIGN KEY (AcademicTermId) REFERENCES dbo.AcademicTerms(Id)
);

CREATE TABLE dbo.CourseOfferings (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CourseId UNIQUEIDENTIFIER NOT NULL,
    SectionId UNIQUEIDENTIFIER NOT NULL,
    TeacherId UNIQUEIDENTIFIER NOT NULL,
    AcademicTermId UNIQUEIDENTIFIER NOT NULL,
    RoomCode NVARCHAR(50) NULL,
    DayOfWeek TINYINT NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_CourseOfferings_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CourseOfferings_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_CourseOfferings_Courses FOREIGN KEY (CourseId) REFERENCES dbo.Courses(Id),
    CONSTRAINT FK_CourseOfferings_Sections FOREIGN KEY (SectionId) REFERENCES dbo.Sections(Id),
    CONSTRAINT FK_CourseOfferings_Teachers FOREIGN KEY (TeacherId) REFERENCES dbo.Teachers(Id),
    CONSTRAINT FK_CourseOfferings_AcademicTerms FOREIGN KEY (AcademicTermId) REFERENCES dbo.AcademicTerms(Id)
);

CREATE TABLE dbo.Enrollments (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    StudentId UNIQUEIDENTIFIER NOT NULL,
    CourseOfferingId UNIQUEIDENTIFIER NOT NULL,
    EnrolledAt DATETIME2 NOT NULL CONSTRAINT DF_Enrollments_EnrolledAt DEFAULT SYSUTCDATETIME(),
    EnrollmentStatus NVARCHAR(30) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Enrollments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Enrollments_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Enrollments_Students FOREIGN KEY (StudentId) REFERENCES dbo.Students(Id),
    CONSTRAINT FK_Enrollments_CourseOfferings FOREIGN KEY (CourseOfferingId) REFERENCES dbo.CourseOfferings(Id),
    CONSTRAINT UQ_Enrollments_Tenant_Student_Offering UNIQUE (TenantId, StudentId, CourseOfferingId)
);

CREATE TABLE dbo.Assignments (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CourseOfferingId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    DueAt DATETIME2 NOT NULL,
    MaxScore DECIMAL(6, 2) NOT NULL,
    CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Assignments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Assignments_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Assignments_CourseOfferings FOREIGN KEY (CourseOfferingId) REFERENCES dbo.CourseOfferings(Id),
    CONSTRAINT FK_Assignments_UserAccounts FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id)
);

CREATE TABLE dbo.Submissions (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    AssignmentId UNIQUEIDENTIFIER NOT NULL,
    StudentId UNIQUEIDENTIFIER NOT NULL,
    SubmittedAt DATETIME2 NULL,
    FileAssetId UNIQUEIDENTIFIER NULL,
    Score DECIMAL(6, 2) NULL,
    Feedback NVARCHAR(1000) NULL,
    SubmissionStatus NVARCHAR(30) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Submissions_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Submissions_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Submissions_Assignments FOREIGN KEY (AssignmentId) REFERENCES dbo.Assignments(Id),
    CONSTRAINT FK_Submissions_Students FOREIGN KEY (StudentId) REFERENCES dbo.Students(Id)
);

CREATE TABLE dbo.AttendanceSessions (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CourseOfferingId UNIQUEIDENTIFIER NOT NULL,
    SessionDate DATE NOT NULL,
    StartedAt DATETIME2 NOT NULL,
    EndedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AttendanceSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AttendanceSessions_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_AttendanceSessions_CourseOfferings FOREIGN KEY (CourseOfferingId) REFERENCES dbo.CourseOfferings(Id)
);

CREATE TABLE dbo.AttendanceRecords (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    AttendanceSessionId UNIQUEIDENTIFIER NOT NULL,
    StudentId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) NOT NULL,
    MarkedAt DATETIME2 NOT NULL CONSTRAINT DF_AttendanceRecords_MarkedAt DEFAULT SYSUTCDATETIME(),
    MarkedByUserId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AttendanceRecords_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AttendanceRecords_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_AttendanceRecords_AttendanceSessions FOREIGN KEY (AttendanceSessionId) REFERENCES dbo.AttendanceSessions(Id),
    CONSTRAINT FK_AttendanceRecords_Students FOREIGN KEY (StudentId) REFERENCES dbo.Students(Id),
    CONSTRAINT FK_AttendanceRecords_UserAccounts FOREIGN KEY (MarkedByUserId) REFERENCES dbo.UserAccounts(Id),
    CONSTRAINT UQ_AttendanceRecords_Tenant_Session_Student UNIQUE (TenantId, AttendanceSessionId, StudentId)
);

CREATE TABLE dbo.Results (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    EnrollmentId UNIQUEIDENTIFIER NOT NULL,
    MarksObtained DECIMAL(6, 2) NOT NULL,
    Grade NVARCHAR(5) NOT NULL,
    GradePoint DECIMAL(4, 2) NOT NULL,
    PublishedAt DATETIME2 NULL,
    PublishedByUserId UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Results_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Results_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Results_Enrollments FOREIGN KEY (EnrollmentId) REFERENCES dbo.Enrollments(Id),
    CONSTRAINT FK_Results_UserAccounts FOREIGN KEY (PublishedByUserId) REFERENCES dbo.UserAccounts(Id)
);

CREATE TABLE dbo.Announcements (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    CollegeId UNIQUEIDENTIFIER NULL,
    CampusId UNIQUEIDENTIFIER NULL,
    Title NVARCHAR(200) NOT NULL,
    Summary NVARCHAR(500) NULL,
    Body NVARCHAR(MAX) NOT NULL,
    Audience NVARCHAR(50) NOT NULL,
    Severity NVARCHAR(30) NOT NULL,
    IsPinned BIT NOT NULL CONSTRAINT DF_Announcements_IsPinned DEFAULT 0,
    PublishedAt DATETIME2 NULL,
    ExpiresAt DATETIME2 NULL,
    CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Announcements_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Announcements_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Announcements_Colleges FOREIGN KEY (CollegeId) REFERENCES dbo.Colleges(Id),
    CONSTRAINT FK_Announcements_Campuses FOREIGN KEY (CampusId) REFERENCES dbo.Campuses(Id),
    CONSTRAINT FK_Announcements_UserAccounts FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id)
);

CREATE TABLE dbo.Notifications (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserAccountId UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Message NVARCHAR(800) NOT NULL,
    Channel NVARCHAR(30) NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    ReadAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Notifications_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_Notifications_UserAccounts FOREIGN KEY (UserAccountId) REFERENCES dbo.UserAccounts(Id)
);

CREATE TABLE dbo.FileAssets (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    FileName NVARCHAR(260) NOT NULL,
    ContentType NVARCHAR(100) NOT NULL,
    StoragePath NVARCHAR(400) NOT NULL,
    FileSizeBytes BIGINT NOT NULL,
    UploadedByUserId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_FileAssets_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_FileAssets_IsDeleted DEFAULT 0,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_FileAssets_UserAccounts FOREIGN KEY (UploadedByUserId) REFERENCES dbo.UserAccounts(Id)
);

ALTER TABLE dbo.Submissions
ADD CONSTRAINT FK_Submissions_FileAssets FOREIGN KEY (FileAssetId) REFERENCES dbo.FileAssets(Id);

CREATE TABLE dbo.AuditLogs (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TenantId UNIQUEIDENTIFIER NOT NULL,
    UserAccountId UNIQUEIDENTIFIER NULL,
    EntityName NVARCHAR(100) NOT NULL,
    EntityId UNIQUEIDENTIFIER NOT NULL,
    ActionName NVARCHAR(50) NOT NULL,
    BeforeJson NVARCHAR(MAX) NULL,
    AfterJson NVARCHAR(MAX) NULL,
    IpAddress NVARCHAR(64) NULL,
    UserAgent NVARCHAR(300) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AuditLogs_UserAccounts FOREIGN KEY (UserAccountId) REFERENCES dbo.UserAccounts(Id)
);

CREATE INDEX IX_Colleges_UniversityId ON dbo.Colleges (UniversityId) WHERE IsDeleted = 0;
CREATE INDEX IX_Campuses_CollegeId ON dbo.Campuses (CollegeId) WHERE IsDeleted = 0;
CREATE INDEX IX_Departments_CampusId ON dbo.Departments (CampusId) WHERE IsDeleted = 0;
CREATE INDEX IX_Programs_DepartmentId ON dbo.Programs (DepartmentId) WHERE IsDeleted = 0;
CREATE INDEX IX_People_CampusId ON dbo.People (CampusId) WHERE IsDeleted = 0;
CREATE INDEX IX_Students_ProgramId ON dbo.Students (ProgramId) WHERE IsDeleted = 0;
CREATE INDEX IX_CourseOfferings_SectionId ON dbo.CourseOfferings (SectionId) WHERE IsDeleted = 0;
CREATE INDEX IX_Enrollments_StudentId ON dbo.Enrollments (StudentId) WHERE IsDeleted = 0;
CREATE INDEX IX_AttendanceRecords_StudentId ON dbo.AttendanceRecords (StudentId) WHERE IsDeleted = 0;
CREATE INDEX IX_Announcements_CampusId_PublishedAt ON dbo.Announcements (CampusId, PublishedAt DESC) WHERE IsDeleted = 0;
CREATE INDEX IX_Notifications_UserAccountId_Status ON dbo.Notifications (UserAccountId, Status) WHERE IsDeleted = 0;
