# University360 Architecture

## Core Principles

- database per microservice
- event-driven integrations through RabbitMQ and MassTransit
- Redis plus HybridCache for low-latency read paths
- JWT-secured APIs with tenant-aware headers and permission claims
- observability-first defaults with OpenTelemetry and Serilog
- migration-first startup with production secret validation
- object storage through signed URLs and provider-compatible configuration

## Current Service Map

- `identity-service`: tenant-aware authentication, refresh sessions, authorization-code exchange, federated provider hooks, passwordless delivery, TOTP MFA, and permission-bearing JWT issuance
- `authorization-service`: centralized roles, permissions, user assignments, and route policy mappings
- `academic-service`: curriculum, courses, credit units, semester scheduling, and faculty advising-note workflows
- `organization-service`: colleges, campuses, departments, staff directory, and public academic catalog ownership
- `attendance-service`: QR and AI attendance capture pipeline with face-recognition upload, teacher-scoped session control, and verification endpoints
- `communication-service`: announcements, principal blogs, push notification orchestration
- `exam-service`: assessment publication, GPA records, and teacher grading-review progression
- `finance-service`: payment recording, provider-aware payment sessions, student-initiated checkout session creation, HMAC webhook processing, refunds, reconciliation runs
- `ai-assistant-service`: role-aware natural-language assistant with Semantic Kernel orchestration, typed service integrations, and RAG hooks
- `student-service`: student profiles, department mapping, academic status, enrollments, and request-fulfillment workflows
- `hostel-service`: rooms, allocations, visitor logs
- `transport-service`: routes and GPS tracking boundary
- `placement-service`: drives, interviews, placement analytics
- `library-service`: books and borrowing records
- `lms-service`: materials, assignments, signed upload/download flows, scan records, and storage lifecycle policies
- `ai-insights-service`: student risk and performance insights
- `analytics-processor-service`: event ingestion, ClickHouse schema bootstrap, export worker, and analytics dashboard endpoints
- `gateway-service`: YARP-based gateway, admin BFF aggregation layer, quotas, WAF-style blocking, and canary headers
- `face-recognition-service`: Python enrollment and embedding verification boundary for AI attendance

## Production Infrastructure

- Docker Compose includes MySQL, Redis, RabbitMQ, MinIO, ClickHouse, and the service stack for local production-like development.
- Helm templates cover the main services with deployments, probes, services, and HPAs.
- CI validates the .NET solution build/test path and the Next.js admin production build.

## Remaining Gaps

- full OpenID Connect authorization-code flow and external SSO federation
- real payment-provider credentials and end-to-end webhook registration
- trained face-recognition model deployment plus vector comparison store
- mature ClickHouse schema/dashboard layer
- service-specific Helm values, ingress, and external secret-provider integration

## Refactor Progress

- `identity-service` now has an explicit internal split between `Domain`, `Application`, `Infrastructure`, and `Api` folders so startup is reduced to service composition and endpoint wiring.
- The next architectural step is to repeat this pattern across the remaining high-change services, starting with finance, attendance, and academic.

## Product Review Refresh

The current repository is stronger on service breadth than on end-to-end product cohesion. The main product gaps found during review were:

- the public homepage depended on static content instead of service-backed campus and program data
- admissions discovery ended at marketing copy with no inquiry capture workflow
- admin operations pages exposed audit and metrics, but not the admissions pipeline created by public traffic
- the blueprint referenced a university -> college -> campus operating model, while the shipped experience did not surface that hierarchy clearly
- authenticated pages overused demo assumptions and underused role-appropriate live data

## Updated Solution Direction

To close the most visible product gaps without creating a parallel architecture, the platform now treats public discovery and admissions as first-class capabilities:

- `organization-service` now carries the live public organization catalog used by the website: colleges, campuses, departments, featured programs, and catalog summary metrics
- `communication-service` carries public homepage content and inquiry capture: announcement feed, ticker items, admissions contact data, and inquiry workflow
- `communication-service` now also owns admissions automation rules that flag stale applications and delayed checklist items into reminder/escalation work
- the web experience should consume those public endpoints directly so homepage sections are no longer maintained as disconnected static UI data
- admin and operations pages should surface inquiry volume, application progression, counseling status, document verification, applicant follow-ups, reminder queues, and public-content health next to existing audit and communication views
- student-service should carry explicit request-fulfillment states so student and admin/mobile surfaces can share the same certificate and document-service workflow model
- academic-service and exam-service should expose teacher-scoped advising and grading actions so faculty experiences are operational, not only observational
- attendance-service and finance-service should expose role-scoped transactional actions so teachers can manage live attendance sessions and students can initiate their own payment journeys inside the product
- production-facing admin views should also surface federation and payment rollout readiness so release risk is not hidden inside appsettings only

## Near-Term Architectural Follow-Up

The dedicated organization boundary is now extracted, but there is still follow-through work to finish:

1. move academic catalog ownership fully to explicit program/course/offering integration contracts between `organization-service` and `academic-service`
2. extend `communication-service` from SLA-style automation into fuller applicant journey orchestration and counselor workload balancing
3. complete live external federation and payment-provider rollout in real environments on top of the new readiness/reporting seams
4. promote more of the public homepage contracts into gateway/BFF aggregation once the new organization boundary is the only source of truth
5. continue decomposing the highest-change services away from one-file minimal-API startup composition
