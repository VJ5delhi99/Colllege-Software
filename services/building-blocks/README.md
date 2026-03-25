# Building Blocks

This project centralizes platform-wide defaults:

- JWT authentication and authorization hooks
- rate limiting
- EF Core + MySQL registration
- HybridCache baseline
- Redis connection registration
- MassTransit + RabbitMQ wiring
- OpenTelemetry tracing and metrics
- Serilog structured logging
- shared integration events

Each service owns its database and domain model. Shared logic here should remain infrastructural and avoid leaking service-specific business rules.
