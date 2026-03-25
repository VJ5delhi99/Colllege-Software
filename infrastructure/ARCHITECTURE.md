# University360 Architecture

## Core Principles

- database per microservice
- event-driven integrations through RabbitMQ and MassTransit
- Redis plus HybridCache for low-latency read paths
- JWT-secured APIs with tenant-aware headers
- observability-first defaults with OpenTelemetry and Serilog

## Current Service Map

- `identity-service`: tenant-aware authentication, role registry, passwordless and MFA hooks
- `academic-service`: curriculum, courses, credit units, semester scheduling
- `attendance-service`: QR and AI attendance capture pipeline
- `communication-service`: announcements, principal blogs, push notification orchestration
- `exam-service`: assessment publication and GPA records
- `finance-service`: payment recording, fee ledgers, provider integration boundary
- `ai-assistant-service`: role-aware natural-language assistant with Semantic Kernel orchestration, typed service integrations, and RAG hooks
- `student-service`: student profiles, department mapping, academic status
- `hostel-service`: rooms, allocations, visitor logs
- `transport-service`: routes and GPS tracking boundary
- `placement-service`: drives, interviews, placement analytics
- `library-service`: books and borrowing records
- `lms-service`: materials, assignments, upload boundary
- `ai-insights-service`: student risk and performance insights
- `gateway-service`: admin BFF aggregation layer

## Next Services To Add

- production auth server and SSO
- payment gateway workers and webhook consumers
- richer analytics store backed by ClickHouse
- production-grade API gateway policies
