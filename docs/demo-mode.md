# Demo Mode

## Purpose

Demo mode allows University360 to run without live backend or database dependency while preserving realistic UI behavior, temporary CRUD workflows, and role-based access simulation.

## Configuration

- Web: `NEXT_PUBLIC_DEMO_MODE=true`
- Mobile: `EXPO_PUBLIC_DEMO_MODE=true`
- Local override is supported in the web app through browser storage for testing, but environment configuration remains the primary switch.

## Behavior

- When demo mode is enabled, the app uses local seeded data instead of real API calls.
- CRUD actions for students, teachers, courses, announcements, and campuses are handled by the mock data service.
- Artificial delay and intermittent simulated failures are used to mimic real network behavior.
- Demo data is reset automatically after 24 hours.
- Users can manually reset seeded data from the demo banner or the demo data lab.

## Seeded Accounts

- `principal@university360.edu / principal-pass`
- `professor@university360.edu / professor-pass`
- `student@university360.edu / student-pass`

## Safety Guarantees

- Demo mode does not call the live identity or operational APIs for demo-authenticated flows.
- Demo data is stored locally and is never written to the production database.
- Real service adapters remain separate from mock service adapters.

## Key Files

- Web config and runtime:
  - `web-admin/app/demo-mode.ts`
  - `web-admin/app/demo-data.ts`
  - `web-admin/app/demo-runtime.ts`
  - `web-admin/app/data-service.ts`
- Web demo UI:
  - `web-admin/app/demo-banner.tsx`
  - `web-admin/app/demo-admin/page.tsx`
- Mobile demo runtime:
  - `mobile-app/app/demo-mode.ts`
  - `mobile-app/app/demo-data.ts`
  - `mobile-app/app/demo-service.ts`
