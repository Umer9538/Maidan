# MAIDAN — working notes

Sports-ground booking, matchmaking and team challenges for Pakistan. Product context lives
in `docs/` — read `04-product-requirements.md` and `07-design-system.md` before changing
behaviour or visuals.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any
code. This project is Expo SDK 57 / React Native 0.86 / React 19 — most tutorials are stale.

## Commands

```
npm start            # Metro. Port 8081 is often taken; use --port 8090
npm run check        # typecheck + lint + tests — run before calling anything done
npm test             # jest
npm run format       # prettier --write

# Jump straight past onboarding and sign-in while building a screen behind them.
# Development builds only — the flag is inert in a release bundle.
EXPO_PUBLIC_DEV_SKIP_GATES=1 npx expo start --port 8090
```

**SDK 54, not 57.** App Store Expo Go is pinned to SDK 54 (v54.0.2, Sept 2025), so the
project matches it. Moving to a newer SDK means building a dev client for the device.

## Layout

```
src/
  app/           expo-router routes only — screens, no shared logic
  components/    icons.tsx, tab-bar.tsx, ui/ (the design system primitives)
  data/          api.ts (the interface), mock-api.ts, queries.ts, provider.tsx, seed.ts
  domain/        types.ts, labels.ts — the vocabulary, no React
  features/      logic grouped by feature (booking, onboarding)
  lib/           pure functions: money, pricing, cancellation, datetime, monogram
  theme/         colors, typography, layout tokens
```

## Rules that are not negotiable

**The three oranges.** `#F76B10` is 2.97:1 on white — it fails AA at every size. It is a
fill colour only. Small orange text on white uses `colors.orangeInk`; on an orange wash,
`colors.orangeDeep`. Anything sitting *on* an orange fill takes `colors.textOnOrange`
(ink), never white. Same for the green unread badge. See `src/theme/colors.ts`.

**No emoji in the interface.** They render differently per platform, ignore `color`, and
read as unfinished. Use `<Icon name="…" />`. ESLint enforces this.

**Text goes through `@/components/ui/text`.** Screens pick a variant from the type scale
rather than inventing a size. ESLint blocks React Native's `Text` outside `ui/`.

**Controls with no handler do not render.** `AppBar` drops actions without `onPress`; an
inert button still takes focus and announces itself to a screen reader.

**Screens depend on `MaidanApi`, never on `mock-api`.** That interface is the seam the real
backend slots into. Swap the implementation in `DataProvider`, change nothing else.

**Booking writes carry an intent id.** `createIntentId()` once per checkout, reused on every
retry. Pakistani mobile networks drop requests and users tap again; the id is what stops a
second booking and a second charge.

**Money is whole rupees.** Never floats. Split with `splitEvenly`, which guarantees the
shares sum to the total exactly.

## Backend

`server/` is Node + Express + PostgreSQL. See `server/README.md` to run it. Two commands
matter: `npm run seed` loads the app's own seed data into Postgres, `npm run smoke` runs 36
end-to-end checks against a live server.

The app talks to it when `EXPO_PUBLIC_API_URL` is set and falls back to the in-memory mock
when it is not — both implement `MaidanApi`, so no screen knows which one it has. Keep the
mock working: it runs the whole app with no network and no database.

The server imports the app's `src/lib` and `src/domain` directly. Pricing and money must not
drift between client and server, so they run the same code rather than two copies of it.

## Sizing

Every design number goes through `src/theme/responsive.ts`. `s()` scales layout with the
viewport width; `ms()` scales type at half that rate, because text growing one-for-one
with the screen reads as a zoomed screenshot. The factor is clamped to 0.88–1.15, and past
480pt the column stops growing and centres — a phone layout stretched to a tablet is just
a phone layout with dead space in every row.

Write the Figma measurement, wrapped: `height: s(78)`, `fontSize: ms(14)`. Keeping the raw
number visible is what makes it checkable against the file.

## Things worth knowing

- **PKT is UTC+5 with no DST**, so `src/lib/datetime.ts` uses a fixed offset rather than
  `Intl` time zones, which are not dependable on Hermes across both platforms.
- **Peak windows wrap past midnight.** Play runs 6 PM–3 AM; `isWithinWindow` handles it.
- **Import fonts per weight** (`@expo-google-fonts/inter/400Regular`), never from the
  package root — the root index pulls all eighteen faces, about 6MB of TTF.
- **Tests: `render` and `fireEvent` are async** in @testing-library/react-native v14. Use
  `renderScreen` from `@/test-utils` so the safe-area and data providers are in place.
- Screens with a running countdown need `jest.useFakeTimers()` plus
  `createMockApi({ latencyMs: 0 })`, or React's act queue never drains and the test hangs.
