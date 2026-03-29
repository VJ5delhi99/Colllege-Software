# College Management Platform QA Test Pack

## 1. Authentication

| ID | Scenario | Expected Result |
|---|---|---|
| AUTH-001 | Login with valid Super Admin credentials | JWT and refresh token returned, role and permission claims included |
| AUTH-002 | Login with invalid password | 401 or validation error with safe message |
| AUTH-003 | Login with inactive user | Access denied, audit log recorded |
| AUTH-004 | Request password reset for valid email | OTP or reset link issued and throttled |
| AUTH-005 | Submit expired OTP | Request rejected with expiry message |
| AUTH-006 | Verify email with invalid token | Request rejected without leaking account state |

## 2. RBAC and scope

| ID | Scenario | Expected Result |
|---|---|---|
| RBAC-001 | Guest opens public homepage chatbot | Allowed without login |
| RBAC-002 | Student calls admin dashboard endpoint | 403 forbidden |
| RBAC-003 | College Admin accesses another college's campus | Denied by scope filter |
| RBAC-004 | Campus Admin creates department in assigned campus | Success |
| RBAC-005 | Teacher attempts role assignment | Denied |
| RBAC-006 | Super Admin lists all colleges | Success with paginated response |

## 3. Organization management

| ID | Scenario | Expected Result |
|---|---|---|
| ORG-001 | Create university with unique code | 201 created |
| ORG-002 | Create college with duplicate code in same tenant | Validation failure |
| ORG-003 | Create campus under non-existent college | 404 or domain validation error |
| ORG-004 | Soft-delete department | Record excluded from active queries |
| ORG-005 | Update campus with stale row version | 409 concurrency conflict |

## 4. Academic workflows

| ID | Scenario | Expected Result |
|---|---|---|
| ACAD-001 | Teacher creates assignment with valid offering | 201 created |
| ACAD-002 | Student submits after due date | Rejected or marked late by business rule |
| ACAD-003 | Create enrollment for same student and offering twice | Duplicate prevented |
| ACAD-004 | Student views timetable with no current enrollments | Clean empty state |
| ACAD-005 | Publish result for missing enrollment | Validation error |

## 5. Announcements and notifications

| ID | Scenario | Expected Result |
|---|---|---|
| COMM-001 | Campus Admin publishes pinned announcement | Announcement visible in campus feed and ticker |
| COMM-002 | Teacher publishes announcement to unauthorized audience | Denied |
| COMM-003 | Notification delivery provider timeout | Retry or failure state captured without app crash |
| COMM-004 | Guest homepage loads with zero announcements | Empty state message shown gracefully |

## 6. File uploads

| ID | Scenario | Expected Result |
|---|---|---|
| FILE-001 | Upload allowed file type under size limit | Success |
| FILE-002 | Upload executable file | Rejected |
| FILE-003 | Upload larger than configured limit | Validation error |
| FILE-004 | Download file without permission | Denied |

## 7. Search and pagination

| ID | Scenario | Expected Result |
|---|---|---|
| DATA-001 | Search courses by title keyword | Matching paginated list returned |
| DATA-002 | Request page beyond available data | Empty collection with pagination metadata |
| DATA-003 | Filter students by campus and department | Only matching scoped records returned |

## 8. UX and resilience

| ID | Scenario | Expected Result |
|---|---|---|
| UX-001 | Homepage loads on mobile width | Layout remains usable and readable |
| UX-002 | Keyboard navigation through top nav and cards | Focus order is logical |
| UX-003 | API failure on announcements panel | Inline error or fallback state shown |
| UX-004 | Slow network on login | Loading state visible, no duplicate submits |
| UX-005 | Empty assignments screen in student dashboard | Helpful zero-data message and CTA |

## 9. Recommended automation split

- API integration tests: auth, organization, academic, announcements, files
- UI E2E tests: homepage, login, role-based dashboards, chatbot, assignment flow
- Security tests: unauthorized access, token tampering, tenant boundary checks
- Accessibility smoke tests: landmarks, contrast, keyboard navigation, labels
