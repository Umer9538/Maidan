# Sports Ground Booking App — Pakistan 🇵🇰

A mobile marketplace where owners of padel courts, futsal grounds, and indoor cricket facilities list their venues and players discover, book, and pay for slots — plus two community pillars no local competitor has: **matchmaking** (open matches anyone can join when a team is short on players) and **team-vs-team challenges** with city leaderboards.

**Research compiled:** 23 Aug 2026 · **Status:** Planning / pre-build

---

## Documentation Index

| Doc | What's inside |
|---|---|
| [01-market-research.md](01-market-research.md) | Pakistan market deep-dive: the 0→350-court padel boom, futsal & box-cricket landscape, hourly pricing data by city, demographics & digital readiness (~140M smartphones, 40M+ wallet users), Ramadan super-season, TAM/SAM/SOM sketch |
| [02-competitor-analysis.md](02-competitor-analysis.md) | 15+ local Pakistani platforms profiled (PlayPro, KhelPoint, Turfy, PakPlay, FR Sports…), regional analogues (Playo, Hudle, Malaeb), global template (Playtomic deep-dive incl. its level system), three-pillar gap analysis |
| [03-business-model.md](03-business-model.md) | Revenue streams & rollout order, payments strategy (JazzCash/Easypaisa/deposit-mode, no Stripe in PK), per-booking unit economics, break-even math, taxes/SECP/compliance, moat & risks |
| [04-product-requirements.md](04-product-requirements.md) | Full PRD: user roles, the three feature pillars in detail, Pakistan-specific product decisions, MVP scope & success criteria, non-functional requirements, key user flows |
| [05-technical-architecture.md](05-technical-architecture.md) | Recommended stack (Flutter + PostgreSQL modular monolith), architecture & domain-model diagrams, double-booking prevention design, payment reconciliation design, build order |
| [06-gtm-and-roadmap.md](06-gtm-and-roadmap.md) | Launch-city decision (recommendation: Lahore), cold-start playbook, positioning, marketing channels, 12-month roadmap with success gates, team & budget, metrics dashboard |
| [07-design-system.md](07-design-system.md) | Design tokens extracted from the Figma file (color, type, layout), the five screens adapted to our product, gaps still to design, and accessibility/token recommendations |

## The Thesis in Five Points

1. **Timing:** Padel went from zero courts (mid-2023) to 350+ courts / ~50k players; futsal and box cricket boom alongside — yet booking still happens by phone call, WhatsApp, and Instagram DM, even at premium venues.
2. **Whitespace:** A dozen local apps launched 2024–26 but all are sub-scale, single-city, or single-sport; **none** has real matchmaking, and **nobody** (locally or globally, except Gulf-based Malaeb) does team-vs-team challenges — which map perfectly onto Pakistan's standing-team futsal and tape-ball culture.
3. **Model:** Supply-first with a free venue tool (0% commission on venues' own bookings), monetizing app-originated bookings (5–10%) + a small player convenience fee + premium venue SaaS — the pattern proven by Playtomic (€29M revenue), Hudle, and Playo, adapted for Pakistan's cash-deposit culture.
4. **Moat:** Booking is a commodity; the social graph (teams, skill levels, reliability scores, leaderboards) and venue software lock-in are not.
5. **Path:** Win Lahore (most padel supply in PK, compact geography, and it denies Playtomic its only local beachhead) → ~10k bookings/month break-even → Karachi → Islamabad. Land the community launch just before Ramadan, the year's biggest demand spike.
