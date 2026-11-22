# Aura Dine

Hebrew voice table-booking platform. The MVP covers one pilot restaurant: a customer opens the restaurant page, talks to a Hebrew voice assistant in the browser, and ends with a booking saved in our own reservation system. The product spec is organised by numbered sections (e.g. §9 booking rules, §11 closed restaurant, §18 data separation); code comments and the README refer to those numbers.

## Commands

Node.js is installed at `C:\Program Files\nodejs`; add it to PATH in a new shell if `node` is not found.

```bash
npm run setup       # prisma generate + create SQLite DB + seed pilot data
npm run dev         # http://localhost:3000
npm test            # vitest (engine, service, agent, auth)
npm run typecheck   # tsc --noEmit
npm run db:seed     # re-seed dev data (wipes existing rows)
```

Run `npm test` and `npm run typecheck` before every commit.

## Architecture

- `src/lib/booking/engine.ts`: pure booking rules (slot grid, hours, table choice, alternatives). No DB access.
- `src/lib/booking/service.ts`: DB operations on top of the engine. Every function takes `restaurantId` and scopes every query by it.
- `src/lib/agent/`: Claude voice agent (`prompt.ts`, `tools.ts`, `run.ts`). History lives in `CallSession.messages` and is only appended to.
- `src/lib/voice/`: browser Web Speech API wrappers (STT/TTS), behind small interfaces so they can be swapped.
- `src/lib/sms/`: `SmsProvider` interface; the only implementation is a mock that writes to `SmsLog`.
- `src/lib/auth.ts`: manager login (email + password, signed cookie) and email-OTP password reset.
- `src/app/`: public pages (`/`, `/r/[slug]`), call API (`/api/call/*`), manager admin (`/admin/*`).
- `prisma/schema.prisma`: data model. Prisma 7 with the better-sqlite3 adapter; client is generated into `src/generated/` (gitignored, created by `npm run db:generate`).

## Rules that must not be broken

- **No double booking.** Each booking writes one `TableSlot` row per 30-minute slot, with a unique constraint on (table, slot). Never bypass it. Keep the concurrency test in `tests/service.test.ts` passing.
- **Confirm only what was saved.** The end screen and the agent may only report a booking that exists in the database with status CONFIRMED. Never base a confirmation on model text.
- **Restaurant isolation (§18).** `restaurantId` always comes from the server-side session, never from model input or the client. Every query filters by it.
- **Closed restaurant (§11).** While the restaurant is closed, availability and booking tools refuse. This is enforced in `engine.validateRequest`, not only in the prompt. It sits behind the `allowBookingWhenClosed` flag (default off).
- **Single table per booking (§9.9).** Tables are never combined.
- **Alternatives (§9.8).** Exactly two: one earlier and one later when possible, otherwise the two nearest.
- **Times are Asia/Jerusalem wall-clock.** Use `src/lib/time.ts`; do not use the server's local timezone.

## Conventions

- All user-facing text is Hebrew and RTL (`<html lang="he" dir="rtl">`). Agent replies are spoken aloud: short sentences, no markdown.
- The voice agent uses `claude-opus-5-5`, `effort: "low"`, and the server-side fallback beta. Do not send `thinking: disabled`, `budget_tokens`, or a forced `tool_choice` (all rejected by this model). Do not edit earlier messages in a stored conversation.
- Enum-like DB fields are strings validated in TypeScript, to stay portable between SQLite and Postgres.
- Prisma refuses `db push --force-reset` from an AI agent; tests delete and recreate `test.db` instead (`tests/global-setup.ts`).
- Secrets live in `.env` (gitignored). Never commit it or print key values. `.env.example` lists the variables.

## Git workflow

- `main`: stable branch. `dev`: integration branch where new work lands first.
- Work on `dev` (or feature branches off it) and merge into `main` when tested. Do not commit directly to `main` once the project is past the initial commit.

## Open decisions (placeholder values in use)

Seating 90 min; at most 2 clarification requests before offering a callback; password-reset code 15 min / 5 attempts; staff handoff is a recorded callback request (no live transfer in a browser call). See the README for the full table.

## Out of scope for the MVP

Restaurant onboarding (§15), Aura staff console (§16), audit log (§17), multi-restaurant search filters (§3.1), other languages, reminders, waitlist, delivery/takeaway.
