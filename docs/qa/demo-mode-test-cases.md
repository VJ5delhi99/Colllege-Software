# Demo Mode QA Test Cases

## Configuration

1. Set `NEXT_PUBLIC_DEMO_MODE=true` and verify the web app renders the demo banner.
2. Set `EXPO_PUBLIC_DEMO_MODE=true` and verify the mobile app renders the demo banner and reset button.
3. Set both flags to `false` and verify demo-only UI is hidden.

## Auth

1. Sign in with each seeded demo user and verify role-specific portal behavior.
2. Attempt sign-in with an invalid demo password and verify a validation error is shown.
3. Verify logout clears the demo session without calling live logout endpoints.

## CRUD

1. Open the web demo data lab and create a student, teacher, course, announcement, and campus.
2. Delete records from each module and verify the list updates immediately.
3. Verify validation errors are surfaced for empty required fields.
4. Repeat save/delete actions until a simulated network error appears and verify the UI remains recoverable.

## Reset

1. Use the manual reset buttons and verify seeded data is reloaded.
2. Force the stored dataset timestamp to be older than 24 hours and verify a fresh dataset is loaded automatically.
3. Verify demo data from one browser session does not leak into production mode when `NEXT_PUBLIC_DEMO_MODE=false`.

## Safety

1. Inspect browser network traffic in demo mode and verify no live auth or CRUD requests are issued for demo-only flows.
2. Verify mobile chat and dashboard use seeded local data in demo mode.
3. Verify production mode still requires real session hydration and does not use seeded credentials automatically.
