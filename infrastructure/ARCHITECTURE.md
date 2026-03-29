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
- `academic-service`: curriculum, courses, credit units, semester scheduling
- `attendance-service`: QR and AI attendance capture pipeline with face-recognition upload and verification endpoints
- `communication-service`: announcements, principal blogs, push notification orchestration
- `exam-service`: assessment publication and GPA records
- `finance-service`: payment recording, provider-aware payment sessions, HMAC webhook processing, refunds, reconciliation runs
- `ai-assistant-service`: role-aware natural-language assistant with Semantic Kernel orchestration, typed service integrations, and RAG hooks
- `student-service`: student profiles, department mapping, academic status
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
