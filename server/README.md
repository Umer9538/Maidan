# MAIDAN API

Node + Express + PostgreSQL. A modular monolith, as `docs/05-technical-architecture.md` §3
prescribes — one process, clean seams, no microservices for a launch.

## Running it

```bash
brew services start postgresql@15     # once
createdb maidan                       # once
npm install
npm run migrate --db=maidan           # sql/, in order
npm run seed                          # loads the app's own seed data
npm start                             # http://localhost:4000
npm test                              # unit + service tests (needs the database)
npm run smoke                         # 49 end-to-end checks against the running server
```

`npm run smoke` books real slots and does not clean up after itself, so run `npm run seed`
before each pass. A second run against the same data exhausts the free evening slots and
fails on a missing one rather than on anything being wrong.

`AUTH_SECRET` signs access tokens. Development generates a throwaway and warns; production
refuses to start without one, because a signing key compiled into a shipped binary is the
same as no signature at all.

```bash
AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
```

Every seeded player can sign in, at `<player-id>@maidan.test` with the password in
`seed.ts`. `player-self` is the app's own account and `owner-ahmed` owns Padel Republic —
useful for poking at the owner endpoints by hand.

Then point the app at it:

```bash
# From the repo root. Use your LAN address, not localhost — on a phone, localhost is the phone.
EXPO_PUBLIC_API_URL=http://192.168.0.121:4000 npx expo start --port 8090
```

Leave `EXPO_PUBLIC_API_URL` unset and the app falls back to its in-memory mock. Both
implement the same `MaidanApi`, so no screen knows the difference.

## Authentication and authorisation

They are separate problems and the code keeps them apart.

**Authentication** is a bearer token, verified by `requireAuth` before any route runs. Only
the paths in `authorize.ts`'s `PUBLIC` set skip it, so an endpoint added later is behind
sign-in without anyone remembering to say so — forgetting fails closed rather than open.
Access tokens last 15 minutes and are signed and stateless; refresh tokens last 30 days and
are rows, which is what makes signing out mean something.

Refresh tokens rotate, and a token presented twice revokes the whole family. Nothing here
can tell whether the second use was the owner or a thief, so neither keeps the session. The
client side of that matters: several requests hitting 401 at once must start **one**
refresh, or the app signs itself out. `createHttpApi` shares the in-flight refresh for
exactly this reason.

**Authorisation** is per row, in `authorize.ts`, because knowing who is calling is not the
same as knowing what is theirs. "Not yours" and "not found" give the same answer — a
distinct one turns any id parameter into a probe for which records exist.

## Venue onboarding

An owner registers their ground and its courts and then waits. Until someone at MAIDAN
approves it, **nothing they have listed is bookable** — not in the app, and not at their own
counter.

```
pending   submitted, waiting on a human
rejected  turned down, with a note saying what to fix
verified  approved; the owner may publish once there is a court
live      in search, and bookable
```

Hiding an unapproved venue from search was never enough on its own: its courts are still
reachable by id, so slots could be listed and bookings taken against a ground nobody had
confirmed exists. The status is checked in `booking-service.loadCourt` and
`assertVenueLive`, which every read and every sale passes through — the owner's walk-in path
included, because an owner should not be able to start trading on their own say-so.

`verified` and `live` are separate on purpose. Approval says the ground is real; publishing
says the owner is ready. Publishing needs at least one court, or the ground appears in
search with nothing to book.

Admin is a flag on the player, checked against the database on every call rather than
carried in the token — someone whose rights are withdrawn loses them now, not at their next
refresh. The seed grants it to `player-self`; in production it is granted deliberately, one
account at a time, and never by a script.

```
GET  /admin/venues?status=pending      the review queue
POST /admin/venues/:id/approve         -> verified
POST /admin/venues/:id/reject          -> rejected, `note` required
POST /venues/:id/publish               owner: -> live
POST /venues/:id/unpublish             owner: -> verified, stops selling at once
```

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

- **No SMS provider.** OTP codes are generated, hashed and rate-limited for real, but
  nothing sends them: outside production the code is logged and returned on the response so
  the flow can be completed by hand. Wiring a provider is a change to `requestOtp` alone.
- **Passwords cannot be reset.** `/auth/login` and the OTP flow both work; there is no
  "forgot password" round trip yet, so an account with a lost password has to sign in by
  phone instead.
- **No payment gateway.** `payment_events` exists to store raw webhooks for replay
  (docs/05 §5.2), but nothing writes to it yet. A booking is currently confirmed on the
  client's say-so; in production it must confirm on a verified webhook, never a callback.
- **No settlement.** Weekly owner payouts (docs/03 §2.3) are not modelled.
- **A ground open past midnight** has its small-hours slots on the following day's sheet.
  That is what a calendar means, but if owners find it confusing, a business day ending at
  5 AM is the fix — worth asking during venue onboarding.
