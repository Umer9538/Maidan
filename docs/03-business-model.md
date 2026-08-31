# Business Model

**Status:** v1 — 23 Aug 2026, based on web research compiled Aug 2026 (sources 2024–2026)
**Currency:** PKR figures assume ~PKR 280/USD where converted.

---

## 1. What the Research Says (evidence base)

### 1.1 Payments reality in Pakistan

- **Mobile wallets are the rails.** JazzCash (~48M registered, ~20.6M monthly active) and Easypaisa (59M+ registered, ~20M monthly active) together cover roughly 40M monthly active payers — far more than the card base. The State Bank reports 80M+ active mobile wallet accounts. (ProPakistani, TechJuice, XPay/PostEx)
- **Cash still dominates commerce.** Cash on delivery is ~75–85% of Pakistani e-commerce transactions; card penetration is structurally low. (PCMI, US ITA)
- **Stripe/PayPal are not available in Pakistan.** Realistic gateways: Safepay (2.9% + Rs 30 domestic), PayFast/GoPayFast (~1.5–3%), XPay, Rapid Gateway (2–2.5% published), bank gateways (2–4.5% + setup fees), or direct JazzCash/Easypaisa APIs. (Safepay docs, Rapid Gateway, XStak)
- **Raast** (SBP instant payments, ~Rs 50T processed in 2025) is free/near-free; merchant leg (P2M) is small but doubling. It is the cheapest settlement rail — ideal for venue payouts. (ProPakistani, Business Recorder, SBP)

**Consequences for us:**
1. Expect a large "book online, pay at venue" cohort — design for deposits, not full prepayment.
2. Gateway fees of 2–3% on the full booking value would eat 20–30% of a 10% commission. Collect only the **deposit/convenience portion online** where possible, and pay venues out via Raast/wallets.
3. Bookings of physical services are exempt from Google/Apple in-app billing (15–30% cut), so payments run through local gateways legally.

### 1.2 What comparable platforms charge (benchmarks)

| Platform | Market | Model | Take |
|---|---|---|---|
| **Playtomic** | Global padel leader (4.7M players, 6,000+ clubs, €346M TTM volume) | Club SaaS (tiered) + booking commission + ~4% booking fee | 5–15% per booking; **~8.4% implied blended take** (€29M net revenue / €346M volume) |
| **Hudle** | India (2,000+ venues, 60 cities, 150k games/month, $2.5M Series A 2025) | **"0% commission"** to venues; monetizes player convenience fee + subscriptions + venue software | Small player-side fee (unpublished) |
| **Playo** | India/Gulf (5M+ users, 35+ cities on <$3M raised) | Booking commission + premium subscriptions + Karma loyalty points | Unpublished |
| **Malaeb** | Gulf football/futsal (~200k users) | **Pivoted from % commission to flat monthly SaaS** after venue resistance | Flat subscription |

**Key lesson:** in price-sensitive South Asian markets, venues resist commissions on their existing volume. Winners either (a) shift fees to players (Hudle), (b) charge flat SaaS (Malaeb), or (c) earn the commission by demonstrably generating *new* demand (Playtomic: clubs report +45% bookings within 6 months).

### 1.3 Pakistan unit economics inputs

Hourly rates (2025–26 listings):

| Sport | Rate (PKR/hr) | Notes |
|---|---|---|
| Padel — Karachi | 4,500–7,500 | Premier Club peak 7,500; discounts common off-peak |
| Padel — Lahore | 5,000–5,500 | Casa de Padel |
| Padel — Islamabad/Rwp | 2,500–6,000 | Wide spread by facility |
| Futsal — Karachi | 1,500–3,600 | Gulshan 2,500–3,500; Clifton from 3,600 |
| Indoor cricket — Karachi | 1,500–4,000 | Xtreme Sport 2,500–3,500 |
| Multi-sport (KhelPoint, Lahore) | 1,200–3,500 | |

Supply context: **Pakistan has 350+ padel courts and ~50,000 amateur padel players** (fastest-growing sport; Karachi, Lahore, Islamabad, Faisalabad, Multan, Peshawar). Global padel utilization benchmarks: 85–95% occupancy at peak (5pm–10pm + weekends), <60% weekday daytime, 50–75% blended.

## 2. Our Business Model

### 2.1 Positioning

A **two-sided marketplace with a free SaaS wedge**: free booking-management software for venue owners (single-player mode that's valuable with zero app users), plus a player marketplace that generates *incremental* bookings — and we only monetize the incremental demand and player convenience, never the venue's existing walk-in volume. This directly avoids the resistance that forced Malaeb's pivot and copies the wedge that worked for Hudle and Playtomic.

### 2.2 Revenue streams (in order of rollout)

| # | Stream | Mechanics | When |
|---|---|---|---|
| 1 | **Player convenience fee** | Flat PKR 50–100 per booking made through the app (~1.5–3% of a futsal booking, ~1–2% of padel). Framed as booking-protection fee: confirmed slot + cancellation protection + support | MVP |
| 2 | **Commission on app-originated bookings** | 5–10% only on bookings that come *through the marketplace* (new customers we bring). Padel first (high ticket: PKR 500–600 per booking at 10%); futsal/cricket at the lower band or flat PKR 100–200 | MVP (padel), phase 2 (others) |
| 3 | **Venue SaaS — premium tier** | Free tier: calendar, manual bookings, WhatsApp confirmations. Premium (PKR 5,000–15,000/month): analytics, dynamic pricing tools, promotion tools, staff accounts, priority placement | Month 4–6 |
| 4 | **Featured listings / sponsored placement** | Venues pay for top placement in search and the matches feed | Month 6+ |
| 5 | **Tournament & league hosting** | Entry fees + rake on organized events (Ramadan night tournaments, city leagues); sponsor packages — Pakistan's Premier Padel League (Jan 2026, PKR 30M prize pool) proves sponsor appetite | Month 9+ |
| 6 | **Brand partnerships / advertising** | Sports brands, energy drinks, telco sponsorship of leaderboards & challenges | Year 2 |

Deliberately **not** doing: charging venues for their existing offline bookings; in-app-purchase premium subscriptions at launch (low card penetration makes IAP weak — wallet-billed only, later).

### 2.3 The money flow

```
Player pays (JazzCash / Easypaisa / card / Raast):
  Option A — full prepay:  100% online  → we deduct fee+commission → weekly payout to venue (Raast/wallet/bank)
  Option B — deposit mode: 20% deposit online (covers our fee + no-show protection) → 80% cash at venue
Gateway cost: 2.5–3% + Rs 30 (aggregator) on the online portion only
Venue payout: weekly settlement, Raast/wallet transfer (near-zero cost)
```

Deposit mode is the default for futsal/cricket (cash-culture segments); full prepay is pushed for padel (affluent segment, higher no-show cost).

### 2.4 Unit economics (planning estimates)

Per-booking contribution (deposit mode, futsal):

| Item | PKR |
|---|---|
| Booking value | 3,000 |
| Convenience fee (player) | +100 |
| Commission (app-originated, 7%) | +210 |
| Gateway fee on online portion (~700 collected × 3% + 30) | −51 |
| SMS/WhatsApp notification cost | −10 |
| **Contribution per booking** | **~250** |

Per-booking contribution (full prepay, padel):

| Item | PKR |
|---|---|
| Booking value | 5,500 |
| Convenience fee | +100 |
| Commission (10%) | +550 |
| Gateway fee (5,600 × 2.9% + 30) | −192 |
| Notifications | −10 |
| **Contribution per booking** | **~450** |

Illustrative scale math (from research benchmarks, estimates): one padel court ≈ 160 bookings/month at 45% blended utilization ≈ PKR 880k GMV/court/month. If 30% of bookings are app-originated at our padel take, a 20-venue / 60-court padel footprint yields roughly **PKR 1.5–2M/month gross revenue** before opex — from padel alone in one city. Futsal/cricket courts yield one-third to one-half of that per court but exist in far larger numbers.

### 2.5 Break-even sketch (estimate)

Lean monthly opex (3–4 engineers + 2 city ops + servers + support): ~PKR 2.5–3.5M. At blended ~PKR 300 contribution/booking → **~10,000 app bookings/month to break even**, i.e. roughly 330/day across one metro — achievable with ~100–150 active venues at modest app-origination rates. This frames the Series-of-milestones: 30 venues (MVP proof) → 150 venues (break-even city) → second city.

## 3. Taxes, Legal, Compliance (Pakistan-specific)

- **Incorporation:** SECP private limited, online filing ~Rs 1,800–2,200 + name reservation Rs 1,000; 2–5 working days; all-in with consultant + FBR NTN registration typically Rs 25,000–60,000.
- **Sales tax on services is provincial** and applies to our fee/commission revenue: Sindh (SRB) 15% standard, Punjab (PRA) 16%, ICT federal regime. Reduced 3–8% rates may be available for IT-enabled services — worth structuring for.
- **Finance Act 2025 e-commerce regime** (effective 1 Jul 2025): payment intermediaries withhold 1% final income tax on digitally-paid online sales; couriers 2% on COD; marketplaces must file monthly statements (STR-34). Budget real compliance effort as a registered marketplace.
- **5% Digital Presence Proceeds Tax** hits foreign digital vendors — a mild structural advantage for us as a local company against foreign entrants (e.g. Playtomic, which already passively lists at least one Lahore club).

## 4. Competitive Moat

1. **Liquidity moat** (the real one): most venues + most players in a city → self-reinforcing. Fragmented local competition (KhelPoint, BookedHours, PlayPro, Turfy — none funded, none dominant) means the land-grab is open.
2. **The social graph**: teams, match history, reliability scores, and leaderboards don't port to a rival app. Booking is commodity; the community layer is not — this is why matchmaking + challenges are strategic, not nice-to-have (Playo and Malaeb both proved social-first retention).
3. **Venue lock-in via software**: once a venue runs its whole calendar (including walk-ins) on our free dashboard, switching costs are real.
4. **Payments/ops depth**: deposit-mode bookings, Raast payouts, and no-show enforcement tuned to Pakistani cash culture are hard for a global player to copy quickly.

## 5. Funding Context

Pakistan VC is scarce but recovering: $22.5M (2024) → $36.6M (2025), concentrated in fewer deals. No funded sports-facility marketplace exists locally (Tracxn: 79 sports-tech startups, ~4 funded). Nearest analogue Bookme.pk ($7.5M Series A, ticketing) shows local booking plays can raise. Regional comparables raised on strong capital efficiency (Playo: 5M users on <$3M; Hudle: $2.5M Series A at 2,000 venues). **Plan: bootstrap/angel to city-1 liquidity (~PKR 15–25M / $55–90k for 12 months lean), then raise seed on marketplace metrics.**

## 6. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Venues refuse commission | 0% on existing volume; free SaaS wedge; commission only on demand we generate; flat-fee fallback (Malaeb model) |
| Cash culture → low online payment adoption | Deposit mode (small online advance + cash balance); Raast/wallet-first UX |
| No-shows | Deposits, reliability score, strike system, cancellation-policy engine |
| Chicken-and-egg cold start | Supply-first: sign 30+ venues with free tooling before public player launch; single city, single wedge sport (padel) |
| Thin gateway margins | Collect only deposit online; Raast payouts; renegotiate MDR at volume; direct wallet APIs later |
| Copycats (space is easy to enter) | Speed to liquidity + social graph + venue software lock-in |
| Global entrant (Playtomic) | Local payments/cash-mode depth, Urdu/localized ops, DPPT tax headwind for them |
