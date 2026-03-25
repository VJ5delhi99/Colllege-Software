# University360 ERP

University360 is a cloud-native university ERP monorepo scaffold for a distributed, AI-enabled campus platform. The repository now includes seeded backend services, dynamic student and admin dashboards, an AI assistant service, and local infrastructure assets for running the stack in development.

## Repository Layout

```text
/services
  /building-blocks
  /identity-service
  /academic-service
  /attendance-service
  /communication-service
  /exam-service
  /finance-service
  /ai-assistant-service
/mobile-app
/web-admin
/infrastructure
/.github
```

## Implemented Features

### Platform

- .NET 9 microservice baseline with Minimal APIs, EF Core, MySQL, Redis/HybridCache hooks, MassTransit, RabbitMQ, OpenTelemetry, Serilog, rate limiting, and CORS defaults.
- Shared building blocks for authentication hooks, tenant settings, telemetry, caching, and infrastructure conventions.
- Docker Compose stack for MySQL, Redis, RabbitMQ, and the implemented API services.

### Backend Services

- `identity-service`
  - seeded users for student, professor, and principal roles
  - list and detail endpoints for users
  - role catalog endpoint
- `academic-service`
  - seeded course schedule with room, day, and start time
  - course creation and course listing
  - dashboard summary endpoint with next class details
- `attendance-service`
  - seeded attendance records
  - attendance recording endpoint
  - global summary endpoint
  - per-student summary endpoint used by the mobile dashboard and AI assistant
- `communication-service`
  - seeded announcements and principal blog-style content
  - announcement creation and listing
  - dashboard summary endpoint with latest announcement
- `exam-service`
  - seeded published results
  - result publishing and student result listing
  - result summary endpoint with published count and average GPA
- `finance-service`
  - seeded payments
  - payment recording and listing
  - payment summary endpoint with total collections
- `ai-assistant-service`
  - `POST /api/chat`
  - `POST /api/chat/stream`
  - intent routing for attendance, results, schedule, announcements, analytics, posting announcements, and knowledge queries
  - typed downstream clients to academic, attendance, results, and communication services
  - Semantic Kernel integration boundary for OpenAI/Azure OpenAI
  - seeded knowledge documents for handbook and exam-policy RAG responses
  - role-aware access checks
  - development-mode demo access via `X-Demo-Role` header when no JWT is present

### Mobile App

- student dashboard with live data fetches for:
  - attendance
  - latest GPA
  - announcement count
  - next scheduled class
- principal blog card backed by communication service data
- AI chat screen with:
  - suggested prompts
  - live `POST /api/chat` requests
  - loading state
  - error messaging for missing backend/auth configuration

### Web Admin

- admin dashboard with live data fetches for:
  - enrollment count
  - attendance percentage
  - fee collection total
  - announcement count
  - latest announcement
  - next scheduled course
- floating chatbot widget with live `POST /api/chat` integration

## QA Review Summary

### Issues Fixed

- Replaced static web admin metric cards with live service-backed dashboard data.
- Replaced static mobile dashboard tile values with live service-backed values.
- Added seed data so empty databases do not leave pages blank or misleading.
- Added missing summary endpoints needed by UI surfaces.
- Fixed AI assistant integration so attendance queries use per-student data instead of the global attendance aggregate.
- Added development CORS support so browser/mobile clients can call APIs in local setups.
- Added finance service to Docker Compose because the web dashboard depends on payment summary data.
- Tightened AI assistant demo access so unauthenticated header-based role simulation is allowed only in development.
- Expanded `.gitignore` for env files, logs, caches, and IDE noise.

### Current Functional Coverage

- Implemented pages:
  - mobile dashboard
  - mobile AI chat
  - web admin dashboard
  - web AI chat widget
- Implemented working buttons:
  - mobile `Open AI Assistant`
  - mobile suggested chat prompts
  - mobile `Send`
  - web `Ask AI`
  - web widget `Close`
  - web suggested chat prompts
  - web widget `Send`

### Remaining Missing Features

The repository is still not a complete University ERP. The following major features are missing or partial:

- no student-management microservice
- no hostel-management microservice
- no transport-management microservice
- no placement-and-career microservice
- no library-management microservice
- no LMS microservice
- no AI insights service with ClickHouse analytics
- no real authentication flow, token issuance, SSO, or MFA execution path
- no real RBAC policy engine across all services
- no payment gateway integrations
- no QR session lifecycle UI
- no face-recognition pipeline
- no file upload flows for assignments or course materials
- no production-grade API gateway/BFF
- no automated backend/frontend tests
- incomplete Kubernetes and Helm coverage for all services
- no migrations strategy beyond `EnsureCreated`
- no production-safe secrets management

### Known Gaps And Risks

- The AI assistant is functional in development mode without JWT by using `X-Demo-Role`; production should require authenticated claims.
- The frontend apps rely on environment-specific API base URLs. `localhost` defaults are only suitable for local browser development and may not work on physical mobile devices.
- Service data is seeded for demo purposes; it is dynamic from the API/database perspective, but it is not tenant-specific business data yet.
- Build verification in this environment is limited by blocked package restore access to NuGet.

## Local Development Notes

### Backend API ports

- `identity-service`: `7001`
- `academic-service`: `7002`
- `attendance-service`: `7003`
- `communication-service`: `7004`
- `exam-service`: `7005`
- `finance-service`: `7006`
- `ai-assistant-service`: `7007`

### Frontend environment variables

Recommended variables for local development:

- Web:
  - `NEXT_PUBLIC_IDENTITY_API_URL`
  - `NEXT_PUBLIC_ACADEMIC_API_URL`
  - `NEXT_PUBLIC_ATTENDANCE_API_URL`
  - `NEXT_PUBLIC_COMMUNICATION_API_URL`
  - `NEXT_PUBLIC_FINANCE_API_URL`
  - `NEXT_PUBLIC_AI_ASSISTANT_URL`
- Mobile:
  - `EXPO_PUBLIC_ACADEMIC_API_URL`
  - `EXPO_PUBLIC_ATTENDANCE_API_URL`
  - `EXPO_PUBLIC_COMMUNICATION_API_URL`
  - `EXPO_PUBLIC_EXAM_API_URL`
  - `EXPO_PUBLIC_AI_ASSISTANT_URL`

## Tooling Note

The repository targets `net9.0` so it aligns with the SDK available in this workspace. Full build validation still requires NuGet package restore access.
