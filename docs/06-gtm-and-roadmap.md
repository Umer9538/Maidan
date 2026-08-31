# Go-To-Market Strategy & Roadmap

**Status:** v1 — 23 Aug 2026. Synthesizes `01-market-research.md`, `02-competitor-analysis.md`, `03-business-model.md`.

---

## 1. Strategy in One Paragraph

Win **one city** with a **supply-first** launch: sign venues onto a genuinely free booking-management tool (single-player mode — valuable with zero app users), anchored on **padel** (highest ticket, most acute booking pain, most digitally-ready customers), with futsal and box cricket following fast for volume. Monetize only what we create — app-originated bookings and player convenience — never venues' existing volume. Then use the community layer (open matches, team challenges, leaderboards) to build the retention moat no local competitor has, and expand city by city.

## 2. Launch City Decision

| Criterion | Karachi | Lahore | Islamabad/Rwp |
|---|---|---|---|
| Padel supply | 60+ clubs (150+ courts claimed) | **100+ clubs (most in PK)** | ~60 clubs |
| Futsal/cricket density | Highest (largest city, DHA + Gulshan/Scheme 33 arena clusters) | High; FR Sports 26-court chain based here | Moderate |
| Competitor pressure | On Spot, BookMySpot, BookedHours (all weak) | KhelPoint live, FR Sports own-software, **Playtomic's 2 clubs** | Padel Chase, park apps |
| Ops practicality | Largest market, hardest logistics | Compact geography, dense DHA/Gulberg clusters | Smallest, most affluent per capita |

**Recommendation: Lahore first.** Most padel supply in the country, compact venue clusters (DHA Phases, Gulberg, Johar Town) that one small ops team can physically cover, and a strategic reason to move now: Playtomic's only Pakistani beachhead is in Lahore DHA — taking the Lahore padel market denies the global incumbent its entry point. Karachi is city 2 (biggest prize), Islamabad city 3. *This is a recommendation — validate with 2 weeks of on-ground venue interviews in both Lahore and Karachi before committing.*

## 3. Cold-Start Playbook (chicken-and-egg)

**Phase A — Supply first (pre-launch, ~8 weeks):**
1. Manually onboard **30–50 venues** in the launch city with the free owner tool (calendar, manual bookings, WhatsApp confirmations, payment links). Pitch: "stop answering calls at 1 AM; see your whole week; no commission on your own bookings — ever."
2. Photograph and verify every venue ourselves (quality bar competitors don't meet; PakPlay-style listings are stale).
3. Sign 3–5 **anchor venues** (multi-court, high-traffic) with launch-exclusive perks: featured placement for 6 months, zero convenience fee for their first 500 app bookings, co-branded launch tournament.

**Phase B — Demand ignition (launch, weeks 8–16):**
4. Launch player app when — and only when — the calendar data is trustworthy (nothing kills a booking app faster than "booked a slot, venue didn't know").
5. **Guaranteed games** (Playo "GameTime" pattern): we pre-book popular slots and host open matches at fixed per-player prices — manufacturing matchmaking liquidity instead of waiting for it.
6. Seed team challenges by recruiting 20–30 existing standing teams (every futsal arena has regulars; every office has a cricket team) — offer free first challenge-match bookings.
7. Community marketing: partner with padel coaches and club Instagram pages (the discovery channel today); campus ambassadors at LUMS/UCP/Punjab University; sponsor one Ramadan night tournament — Ramadan is the single biggest demand spike of the year for all three sports.

**Phase C — Density before breadth (months 4–12):**
8. Target: 150 venues, 10k bookings/month in city 1 (break-even zone per `03-business-model.md` §2.5) before opening city 2.
9. Use marketplace data to sell venues the premium tier (occupancy analytics, dynamic pricing for their <60% daytime slots).

## 4. Positioning & Messaging

- **To players:** "Book in 30 seconds. Never miss a game for lack of players." One app for padel, futsal, and cricket — see every ground, every price, every slot; join matches at your level; challenge teams in your city.
- **To venue owners:** "Free booking software + new customers. Commission only on bookings we bring you." Anti-no-show protection (deposits + reliability scores) is the emotional hook — every owner has 1 AM no-show stories.
- **Against Playtomic (padel high-end):** JazzCash/Easypaisa/cash-mode, PKR-native, Urdu support, local ops team, plus futsal/cricket — and team challenges they'll never build.
- **Against local apps:** actual liquidity (matches + challenges), verified calendars, and enforced trust (deposits, reliability scores) — not another listings directory.

## 5. Marketing Channels (ranked by expected ROI)

1. **Venue-side distribution (free):** every onboarded venue's counter QR, WhatsApp auto-replies ("book on the app"), and Instagram bio link — the venue's existing audience becomes our install base.
2. **Instagram/TikTok** — where this audience already discovers venues; short-form court content, challenge-result graphics, leaderboard shoutouts.
3. **Tournaments** — Ramadan night events (futsal + tape-ball + padel), corporate leagues; sponsors already active in this space (Bank Alfalah, Tapmad, OPTP sponsor the Karachi Ramadan futsal championship).
4. **Referrals** — credit-based (Rs 200 booking credit both sides); Karma-style loyalty points redeemable against bookings.
5. **Campus & corporate** — university sports societies; office futsal/cricket teams are pre-formed "challenge" units.

## 6. Roadmap

| Phase | Timeline | Product | Ops/GTM | Success gate |
|---|---|---|---|---|
| **0 — Validate** | Weeks 1–4 | Clickable prototype; venue-owner tool spec | 25+ venue-owner interviews (Lahore + Karachi); 50+ player interviews; confirm city choice | 20 signed LOIs from venues |
| **1 — Supply** | Weeks 5–12 | Owner dashboard (calendar, manual bookings, WhatsApp confirmations); admin panel | Onboard 30–50 venues; photograph/verify all | 30 venues managing real bookings in tool |
| **2 — Marketplace** | Weeks 13–20 | Player app (Android): discovery, booking, JazzCash/Easypaisa/card + deposit mode; reviews | Closed beta with anchor venues; guaranteed-game pilots | 1,000 completed app bookings; <5% double-booking/no-show incidents |
| **3 — Community** | Weeks 21–28 | Open matches + chat + reliability scores; teams + challenges + leaderboard | Public launch; Ramadan tournament (align timing!); referral program | 10k MAU; 25% of bookings involve a match/challenge |
| **4 — Deepen** | Months 8–12 | iOS; Urdu; computed skill levels; split payments; premium venue tier | 150 venues; premium-tier sales; sponsor deals | ~10k bookings/month (break-even zone) |
| **5 — Expand** | Year 2 | Tournaments/leagues product; coaching marketplace (Khelomore pattern) | Karachi launch with proven playbook; then Islamabad | City-2 hitting city-1's month-6 metrics faster |

**Calendar note:** Ramadan (expected ~Feb–Mar 2027) is the demand super-season for all three sports — midnight-to-sehri bookings, neighborhood tournaments, 32-team sponsored events. Phase 3 (community launch) should land just before it.

## 7. Team & Budget (lean, 12 months — estimates)

| Role | Count | Notes |
|---|---|---|
| Full-stack engineers | 2–3 | Flutter + backend |
| Designer (contract) | 0.5 | |
| City ops / venue success | 2 | Onboarding, photography, disputes — the real moat-builders |
| Growth/community | 1 | Tournaments, socials, ambassadors |
| Founder(s) | — | Venue sales is a founder job at this stage |

Burn: ~PKR 2.5–3.5M/month all-in → **PKR 30–42M (~$110–150k) for 12 months**. Fundable via angels/bootstrapping given local precedent (Playo reached 5M users on <$3M; Hudle raised $2.5M Series A at 2,000 venues). Raise seed after city-1 liquidity metrics, not before.

## 8. Metrics That Matter (weekly dashboard)

- **Supply:** live venues; % of venue calendars fully managed in-app (incl. walk-ins) — the lock-in metric
- **Liquidity:** bookings/week; app-originated %; open-match fill rate; challenge acceptance rate; time-to-fill for open slots
- **Trust:** no-show rate (target <5% on deposit bookings); double-booking incidents (target 0); review coverage
- **Retention:** 30-day player retention (≥25%); repeat-booking rate; team-level retention (teams with 2+ challenges/month)
- **Economics:** contribution/booking; CAC by channel; gateway fee % of revenue; venue churn

## 9. Top Risks (see `03-business-model.md` §6 for full table)

1. **Calendar trust failure** — one stale calendar poisons the well; mitigation: manual bookings in the same tool, ops follow-up on every mismatch.
2. **Ramadan timing miss** — shipping community features after Ramadan wastes the year's biggest acquisition window.
3. **Playtomic locks Lahore padel high-end** — move fast on DHA Lahore clubs specifically.
4. **A funded copycat** — speed to venue lock-in and the social graph are the only real defenses; the research shows a dozen sub-scale attempts, so execution quality, not the idea, is the differentiator.
