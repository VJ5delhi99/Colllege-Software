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

## Next Services To Add

- student management
- library management
- hostel management
- transport management
- placement and career
- learning management system
- AI insights service backed by ClickHouse
