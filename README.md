# University360 ERP

University360 is a cloud-native university ERP monorepo scaffold for a distributed, AI-enabled campus platform. The repository now includes seeded backend services, dynamic student and admin dashboards, an AI assistant service, a gateway/BFF layer, additional ERP module services, and local infrastructure assets for running the stack in development.

## Repository Layout

```text
/services
  /building-blocks
  /identity-service
  /academic-service
  /attendance-service
  /authorization-service
  /communication-service
  /exam-service
  /finance-service
  /student-service
  /hostel-service
  /transport-service
  /placement-service
  /library-service
  /lms-service
  /ai-insights-service
  /analytics-processor-service
  /gateway-service
  /ai-assistant-service
  /face-recognition-service
/mobile-app
/web-admin
/infrastructure
/tests
/.github
```

## Implemented Features

### Platform

- .NET 9 microservice baseline with Minimal APIs, EF Core, MySQL, Redis/HybridCache hooks, MassTransit, RabbitMQ, OpenTelemetry, Serilog, rate limiting, CORS defaults, health probes, and migration-first database startup.
- Shared building blocks for JWT auth, permission-based endpoint filters, tenant settings, telemetry, caching, signed object-storage URLs, and production secret validation.
- Docker Compose stack for MySQL, Redis, RabbitMQ, MinIO, ClickHouse, face-recognition inference, and the implemented API services.
- Solution and CI entries for backend services, frontend build validation, and test project coverage.

### Identity And Security

- seeded users for student, professor, and principal roles
- role catalog endpoint
- user list/detail endpoints
- JWT token issuance endpoint: `POST /api/v1/auth/token`
- refresh-token endpoint and persisted auth sessions
- passwordless challenge endpoint and MFA challenge flow
- development signing-key based JWT validation support with production secret enforcement
- endpoint-level RBAC and permission filter support through `RequireRoles(...)` and `RequirePermissions(...)`
- AI assistant endpoints require authenticated JWT claims; demo-role headers are no longer accepted
- centralized `authorization-service` for roles, permissions, user-role assignments, and service policy mappings

### Core ERP Services

- `academic-service`
  - seeded course schedule with room, day, and start time
  - course creation and listing
  - dashboard summary endpoint with next class details
- `attendance-service`
  - seeded attendance records
  - per-student attendance summary
  - QR session lifecycle endpoints
  - face-recognition upload, verify, and match-and-record endpoints
- `authorization-service`
  - centralized permissions catalog
  - role creation and permission assignment
  - user-role assignment and route policy mapping
- `communication-service`
  - seeded announcements and principal blog-style content
  - announcement creation and listing
  - dashboard summary endpoint
- `exam-service`
  - seeded published results
  - result publishing and summaries
- `finance-service`
  - seeded payments and invoice references
  - payment session creation
  - provider webhook verification endpoints
  - refund workflow endpoint
  - reconciliation worker and run history
- `student-service`
  - student profile endpoints
- `hostel-service`
  - hostel rooms, allocations, visitor logs
- `transport-service`
  - routes and GPS tracking boundary
- `placement-service`
  - company drives, interviews, placement analytics
- `library-service`
  - books and borrow records
- `lms-service`
  - course materials
  - assignments
  - signed upload/download URL flows backed by object-storage abstractions
- `ai-insights-service`
  - seeded student performance/risk insights
- `analytics-processor-service`
  - event ingestion and ClickHouse HTTP export worker
- `gateway-service`
  - YARP-based authenticated routing
  - BFF aggregation endpoint for admin overview
- `face-recognition-service`
  - Python inference boundary service for AI attendance verification

### AI Assistant

- `POST /api/chat`
- `POST /api/chat/stream`
- intent routing for attendance, results, schedule, announcements, analytics, posting announcements, and knowledge queries
- typed downstream clients to academic, attendance, results, and communication services
- Semantic Kernel integration boundary for OpenAI/Azure OpenAI
- seeded knowledge documents for handbook and exam-policy RAG responses
- role-aware access checks
- JWT-authenticated caller context passed into assistant routing and authorization checks

### Frontend

- mobile student dashboard with live data fetches for attendance, GPA, announcements, and next class
- mobile AI chat screen with suggested prompts, live requests, and error states
- web admin dashboard with live data fetches for enrollment, attendance, fee totals, announcements, and next class
- web floating chatbot widget with live AI assistant requests
- web RBAC console page for roles and permissions visibility
- frontend apps require explicit API base URLs through environment variables instead of hardcoded localhost fallbacks

### Tests

- backend smoke tests for signed object storage and production secret validation in `/tests/Platform.Tests`
- Playwright scaffold for web admin end-to-end coverage in `/web-admin/tests/e2e`

## QA Review Summary

### Issues Fixed

- Replaced static web admin metric cards with live service-backed dashboard data.
- Replaced static mobile dashboard tile values with live service-backed values.
- Added seed data so empty databases do not leave pages blank or misleading.
- Added missing summary endpoints needed by UI surfaces.
- Fixed AI assistant integration so attendance queries use per-student data instead of the global attendance aggregate.
- Added development CORS support so browser/mobile clients can call APIs in local setups.
- Added finance service and the new ERP services to local infrastructure coverage.
- Removed unauthenticated AI assistant demo-role access; assistant requests now require JWT-authenticated claims.
- Added auth token issuance, refresh sessions, passwordless/MFA flows, centralized RBAC service, QR lifecycle endpoints, signed upload flows, payment sessions/webhooks/refunds, gateway/BFF routing, and test scaffolding.
- Expanded `.gitignore` for env files, logs, caches, and IDE noise.
- Added explicit frontend environment-variable configuration so web and mobile clients do not depend on implicit localhost defaults.
- Added tenant-aware filtering across the core dashboard and assistant-backed services using `X-Tenant-Id`.
- Completed solution-level restore, build, backend test, and web admin production build verification in this workspace.

## Current Functional Coverage

### Implemented Pages

- mobile dashboard
- mobile AI chat
- web admin dashboard
- web AI chat widget
- web RBAC catalog

### Implemented Working Buttons

- mobile `Open AI Assistant`
- mobile suggested chat prompts
- mobile `Send`
- web `Ask AI`
- web `Open RBAC Console`
- web widget `Close`
- web suggested chat prompts
- web widget `Send`

## Remaining Missing Or Partial Features

The repository covers more of the ERP now, but several areas are still partial rather than production-complete:

- no full OpenID Connect authorization code flow, federated SSO, or external identity provider integration
- passwordless and MFA flows are implemented as service challenges, but not yet connected to authenticator apps, email, or SMS delivery providers
- payment webhooks and reconciliation are implemented as provider-ready workflows, but not yet wired to live Razorpay, Stripe, or PayPal credentials
- the face-recognition service is a Python inference boundary and not yet a trained FaceNet/ArcFace deployment with Qdrant embeddings
- object storage uses signed URL abstractions and MinIO-compatible config, but antivirus scanning and lifecycle policies are still pending
- ClickHouse export is implemented through the analytics processor, but the downstream warehouse schema/dashboard layer is still minimal
- API gateway routing and auth are in place, but advanced governance such as per-route quotas, WAF rules, and canary routing is still pending
- Playwright test scaffolding exists, but full login, enrollment, attendance, results, and payment end-to-end flows are not yet automated
- Helm now covers the main production services generically, but service-specific values, ingress, and secret wiring still need expansion
- database startup now prefers migrations, but explicit EF migration files and rollback workflows still need to be authored per service
- production secrets validation is implemented, but external secret providers such as Vault, AWS Secrets Manager, or Azure Key Vault are not yet integrated

## Local Development Notes

### Backend API Ports

- `identity-service`: `7001`
- `academic-service`: `7002`
- `attendance-service`: `7003`
- `communication-service`: `7004`
- `exam-service`: `7005`
- `finance-service`: `7006`
- `ai-assistant-service`: `7007`
- `student-service`: `7008`
- `hostel-service`: `7009`
- `transport-service`: `7010`
- `placement-service`: `7011`
- `library-service`: `7012`
- `lms-service`: `7013`
- `ai-insights-service`: `7014`
- `gateway-service`: `7015`
- `authorization-service`: `7016`
- `analytics-processor-service`: `7017`
- `face-recognition-service`: `7100`

### Frontend Environment Variables

- Web:
  - `NEXT_PUBLIC_IDENTITY_API_URL`
  - `NEXT_PUBLIC_AUTHORIZATION_API_URL`
  - `NEXT_PUBLIC_ACADEMIC_API_URL`
  - `NEXT_PUBLIC_ATTENDANCE_API_URL`
  - `NEXT_PUBLIC_COMMUNICATION_API_URL`
  - `NEXT_PUBLIC_FINANCE_API_URL`
  - `NEXT_PUBLIC_AI_ASSISTANT_URL`
- Mobile:
  - `EXPO_PUBLIC_IDENTITY_API_URL`
  - `EXPO_PUBLIC_ACADEMIC_API_URL`
  - `EXPO_PUBLIC_ATTENDANCE_API_URL`
  - `EXPO_PUBLIC_COMMUNICATION_API_URL`
  - `EXPO_PUBLIC_EXAM_API_URL`
  - `EXPO_PUBLIC_AI_ASSISTANT_URL`

Use [.env.example](c:/Users/user/Documents/GitHub/Colllege-Software/.env.example) as the template. Web examples use `localhost`; mobile examples intentionally use `YOUR_MACHINE_IP` because Expo apps running on physical devices cannot call the host machine through `localhost`.

### Image Assets

- The web admin dashboard now includes editorial image slots for the provided graduation and student visuals.
- Expected paths are documented in [README.md](c:/Users/user/Documents/GitHub/Colllege-Software/web-admin/public/images/README.md#L1).

### Authentication And Tenant Context

- Frontend clients obtain a JWT from `identity-service` through `POST /api/v1/auth/token` before calling protected APIs.
- JWTs now carry tenant, role, session, and permission claims.
- Assistant requests must include `Authorization: Bearer <token>`.
- Core dashboard and assistant-backed service queries are tenant-filtered via `X-Tenant-Id`.
- Seed data is still demo-oriented, but it is now partitioned by tenant for the implemented core flows.

## Verification

- `dotnet build Colllege-Software.sln -v minimal`: passed on March 25, 2026
- `dotnet test tests\Platform.Tests\Platform.Tests.csproj -v minimal --no-build`: passed on March 25, 2026
- `npm run build` in `/web-admin` with required env vars: passed on March 25, 2026
- The repository targets `net9.0` and builds successfully with the SDK available in this workspace.
