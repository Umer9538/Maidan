# Product Requirements Document (PRD)

**Product:** Sports ground booking & matchmaking app for Pakistan (working title: TBD)
**Sports covered at launch:** Padel, Futsal, Cricket (indoor nets / box cricket / tape-ball grounds)
**Platforms:** Android-first (Pakistan is ~95% Android), iOS second, plus a web dashboard for venue owners
**Document status:** Draft v1 — 23 Aug 2026

---

## 1. Problem Statement

In Pakistan's major cities (Karachi, Lahore, Islamabad/Rawalpindi, Faisalabad, Peshawar), booking a padel court, futsal ground, or cricket facility today happens through phone calls, WhatsApp messages, and Instagram DMs. This creates problems on both sides:

**For players:**
- No way to see which grounds exist nearby, their prices, or photos without asking around.
- No visibility into slot availability — you call, wait for a reply, and often the slot is gone.
- Double bookings and last-minute cancellations with no accountability.
- Hard to find opponents or fill an incomplete team — games get cancelled because "we're only 8, we need 10."

**For ground owners:**
- Bookings are managed in notebooks or WhatsApp chats; double-booking and no-shows are common.
- No-shows cost real revenue since there's no advance payment mechanism.
- No marketing channel beyond word of mouth and an Instagram page.
- Off-peak hours (daytime, weekdays) sit mostly empty with no way to promote them.

## 2. Product Vision

A single app where any player in Pakistan can discover, compare, and book a sports facility in under a minute — and never have to cancel a game for lack of players, because the app fills incomplete matches and finds opposing teams.

## 3. User Roles

| Role | Description |
|---|---|
| **Player** | Books slots, joins open matches, creates/joins teams, challenges other teams |
| **Team Captain** | A player who owns a team roster; can book on behalf of the team and issue/accept challenges |
| **Venue Owner** | Lists one or more venues, manages courts/grounds, slots, pricing, and bookings; sees earnings |
| **Venue Staff** (post-MVP) | Limited owner account: check-ins and schedule view only |
| **Admin (us)** | Verifies venues, manages disputes, refunds, content moderation, analytics |

## 4. Core Features

### Pillar 1 — Venue Discovery & Booking

**Discovery**
- Browse/search venues by sport, city, and area; map view and list view.
- Venue profile: photos, sports offered, court/ground details (surface, indoor/outdoor, lighting, size e.g. 5-a-side / 7-a-side), amenities (parking, washrooms, showers, seating, equipment rental, prayer area, female-friendly timings), price per hour, rules, location with directions.
- Ratings & reviews (only from users with a completed booking — verified reviews).

**Slot booking**
- Real-time availability calendar per court/ground (30-min or 60-min granularity, owner-configurable).
- Peak / off-peak pricing set by owner (night slots are peak in Pakistan's heat; owners can discount daytime).
- Booking flow: pick venue → pick court → pick date/slot(s) → pay (or reserve with partial advance) → confirmation with booking code.
- Booking states: `pending → confirmed → checked-in → completed / cancelled / no-show`.
- Cancellation policy engine: owner picks a policy (e.g. free cancel until 6h before, 50% until 2h, no refund after); app enforces it automatically.
- Recurring bookings (post-MVP): "every Tuesday 10pm" for regular groups.
- Split payment (post-MVP): booking cost divided among joined players.

**Payments (Pakistan-specific)**
- MVP: JazzCash, Easypaisa, debit/credit cards via a local gateway, plus **"advance + pay at venue"** mode (small online advance to kill no-shows, remainder in cash) — cash culture is dominant and must be accommodated, not fought.
- Owner payouts: weekly settlement to bank/JazzCash/Easypaisa, minus commission.

**Venue owner dashboard (web + app)**
- Calendar with all bookings (app + manually added walk-in/phone bookings so the calendar stays truthful).
- Court/ground management, pricing rules, blackout dates, maintenance blocks.
- Earnings reports, settlement history, no-show tracking.
- Customer list with repeat-booking stats.

### Pillar 2 — Matchmaking (Open Matches)

Solves: "we don't have enough players."

- Any player booking a slot can mark the match as **open** and specify: sport, format (e.g. futsal 5v5), total players needed, players already committed, skill level (Beginner / Intermediate / Advanced), cost per joining player, gender preference (open / male / female — required for the Pakistani market), and optional note.
- Open matches appear in a **"Matches near you"** feed filtered by sport, area, date, and skill level.
- A player requests to join (or joins instantly if the host allows); host approves; joiner pays their share (online or committed-cash flag).
- Match chat room for coordination (in-app, so phone numbers aren't exposed — important for privacy and for keeping activity in the app).
- After the match: players confirm who showed up; no-show strikes affect a player **reliability score** shown next to their name.
- Skill levels start self-declared; post-MVP move to a Playtomic-style computed level per sport based on match results and peer confirmation.

### Pillar 3 — Team Challenges

Solves: "our team wants competitive matches against new opponents."

- Players create a **Team**: name, sport, city, logo, roster (invite via link/phone contacts), captain role.
- **Challenge flow A (open challenge):** captain posts "We challenge any Intermediate team, futsal, Gulshan area, this weekend, loser pays / split cost." Other captains browse the challenge board and accept.
- **Challenge flow B (direct challenge):** captain finds a specific team's profile and challenges them directly.
- On acceptance the app pushes both captains into a shared flow: agree venue + slot → book it → both teams pay their share.
- Result reporting: both captains confirm the score; wins/losses build a **team record and city leaderboard** per sport.
- Post-MVP: seasonal city leagues and tournament hosting (bracket generation, entry fees) — this is a strong monetization and engagement lever around Ramadan night tournaments.

### Cross-cutting

- **Auth:** phone number + OTP (primary — email is secondary in Pakistan). Optional Google sign-in.
- **Language:** English UI at MVP with Roman-Urdu-friendly copywriting; full Urdu localization post-MVP.
- **Notifications:** push + WhatsApp/SMS fallback for booking confirmations (WhatsApp Business API), reminders 24h and 2h before slot.
- **Trust & safety:** venue verification before going live (we visit/verify photos), player reliability score, report/block, review moderation.

## 5. MVP Scope (Phase 1)

| In MVP | Deferred |
|---|---|
| Player app (Android) — discovery, booking, payments, open matches (basic), reviews | iOS app (fast-follow), full Urdu localization |
| Venue owner app/web — calendar, slots, pricing, manual bookings, payouts | Staff sub-accounts, advanced analytics |
| Open matches with self-declared skill level + match chat | Computed skill ratings, split payments |
| Teams + direct & open challenges + basic leaderboard | Leagues, tournaments, bracket hosting |
| JazzCash / Easypaisa / card + advance-plus-cash mode | Wallet, loyalty points |
| One launch city (recommendation: start with one city, dominate, expand) | Multi-city ops |

**MVP success criteria (first 6 months in launch city):**
- 30+ venues live and actively managing their calendar in the app
- 2,000+ completed bookings through the app
- 25% of bookings involve an open match or challenge (proves the differentiator)
- <5% no-show rate on advance-paid bookings
- 30-day player retention ≥ 25%

## 6. Non-Functional Requirements

- **Offline-tolerant:** app must degrade gracefully on 3G/spotty networks; aggressive caching of venue data; booking writes must be idempotent and queue-safe.
- **Low-end devices:** support Android 8+, APK size lean, works on 2GB RAM devices.
- **Concurrency:** slot locking to prevent double-booking (hold slot for 5 min during checkout).
- **Availability:** booking APIs 99.5%+; peak load is 6pm–1am Pakistan time and Ramadan nights.
- **Data:** user data stored per Pakistan's Personal Data Protection framework; PCI-scope offloaded to payment gateway.

## 7. Key User Flows (summary)

1. **Book a ground:** Open app → sport tab → nearby venues → pick venue → pick slot → pay/advance → confirmation code → play → auto-prompt to review.
2. **Join a match:** Matches feed → filter futsal + tonight → request to join → approved → pay share → chat → play → confirm attendance.
3. **Challenge a team:** My Team → post open challenge → rival captain accepts → agree slot at suggested venue → both pay → play → both confirm score → leaderboard updates.
4. **Owner adds a walk-in:** Owner app → calendar → tap empty slot → "manual booking" → name/phone → slot blocked everywhere instantly.

## 8. Open Questions

- Launch city: Karachi (biggest market, padel boom) vs Lahore (dense futsal culture) — decide with on-ground venue interviews.
- Commission vs SaaS pricing for owners at launch (see business model doc `03-business-model.md`).
- Whether to seed supply by building free booking-management tooling for owners before opening the player marketplace.
