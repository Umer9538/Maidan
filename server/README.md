# MAIDAN API

Node + Express + PostgreSQL. A modular monolith, as `docs/05-technical-architecture.md` §3
prescribes — one process, clean seams, no microservices for a launch.

## Running it

```bash
brew services start postgresql@15     # once
createdb maidan                       # once
psql -d maidan -f sql/001_schema.sql  # migrations
npm install
npm run seed                          # loads the app's own seed data
npm start                             # http://localhost:4000
npm run smoke                         # 36 end-to-end checks against the running server
```

Then point the app at it:

```bash
# From the repo root. Use your LAN address, not localhost — on a phone, localhost is the phone.
EXPO_PUBLIC_API_URL=http://192.168.0.121:4000 npx expo start --port 8090
```

Leave `EXPO_PUBLIC_API_URL` unset and the app falls back to its in-memory mock. Both
implement the same `MaidanApi`, so no screen knows the difference.

## The two things that must never break

**Slot integrity.** `bookings_no_overlap` is a Postgres `EXCLUDE USING gist` constraint over
`(court_id, tstzrange(start_at, end_at))`, skipping cancelled rows. Double-booking is
impossible *by construction* — two requests racing for the same court and hour cannot both
commit, whatever the application layer does. Walk-ins go through the same path, so a court
cannot be sold at the counter and in the app at once.

The 5-minute checkout hold lives in `slot_holds` with a unique index on
`(court_id, start_at)`; expired rows are swept before every read. Redis in production
(docs/05 §5.1) — a table here keeps local testing to one dependency, and behaves the same.

**Idempotency.** `bookings.intent_id` is unique. A client that retries a dropped request
gets the original booking back, not a second one and a second charge. The handler checks
for the intent first and also catches the unique violation, so two retries landing at once
still resolve to one booking.

## Shared code, not copied code

The server imports `@/lib/pricing`, `@/lib/money` and `@/domain/types` from the app. A slot
priced one way on the phone and another on the server is an argument with a customer; the
only way to guarantee they agree is to run the same code. Those modules are React-free by
construction, so they compile here unchanged.

## Not done yet

- **Auth is a stub.** The caller's id arrives in `x-user-id`. Phone + OTP and real tokens
  come with the SMS provider; every handler reads the id from `currentUser`, so that swap
  touches one function.
- **No payment gateway.** `payment_events` exists to store raw webhooks for replay
  (docs/05 §5.2), but nothing writes to it yet. A booking is currently confirmed on the
  client's say-so; in production it must confirm on a verified webhook, never a callback.
- **No settlement.** Weekly owner payouts (docs/03 §2.3) are not modelled.
- **A ground open past midnight** has its small-hours slots on the following day's sheet.
  That is what a calendar means, but if owners find it confusing, a business day ending at
  5 AM is the fix — worth asking during venue onboarding.
