# Design System & Figma Screen Mapping

**Status:** v1 — 23 Aug 2026
**Source:** Figma document "🎨 Design" (an event-app UI kit adapted to our product), plus a new page `📱 MAIDAN App` built from scratch
**Updated:** 24 Aug 2026 — added four natively-built screens (§4)
**Working app name:** **MAIDAN** (Urdu: میدان, "ground/field") — placeholder, easy to change; chosen to avoid collision with local competitors KhelPoint, Kheylo, Khelo, PlayPro, Turfy.

---

## 1. What Was in the File

The source file is an events/ticketing UI kit ("Event" branding, Dhaka locations, USD pricing). Two distinct clusters:

| Cluster | Contents | Editable? |
|---|---|---|
| Numbered screens `01_Splash` → `59_Share` (88 frames) | Full app flow previews | **No** — flattened raster frames with zero child layers |
| "Free Design Sample" cluster | Onboarding, Event Details, See All Events, Message | **Yes** — full vector/text layers |
| Promo frames (View More, About Me, Information, Full Design Preview) | Template author's marketing slides | Left untouched — not part of our app |

The file has **no published color/text styles and no components** (`get_styles` and `get_local_components` both return empty), so the tokens below were extracted from the raw layers.

## 2. Design Tokens (extracted)

### Color
| Token | Hex | Usage |
|---|---|---|
| `primary/orange` | `#F76B10` | CTAs, prices, links, active states, brand |
| `ink/900` | `#20222C` | Primary text, dark buttons (gradient `#20222CDB → #20222C`) |
| `surface/base` | `#FBFBFB` | Screen background |
| `surface/raised` | `#FFFFFF` / `#FDFDFD` | Cards, sheets, text on dark |
| `surface/muted` | `#F0F0EE` | Icon circles, chips, input fills |
| `border/subtle` | `#E1E1E1` | Dividers, drag handles |

Dividers use a horizontal gradient of `ink/900` at 20% opacity, fading at both ends — keep this, it's a nice detail.

### Typography — Inter throughout
| Role | Size / Weight / Line-height |
|---|---|
| Screen title | 20 / SemiBold 600 / 30 |
| Section & card title | 14 / SemiBold 600 / 17 |
| Body | 14 / Regular 400 / 24 |
| Secondary body | 12 / Regular 400 / 22 |
| Meta / labels | 10 / Regular 400 / 12 |
| Button label | 14 / SemiBold 600 / 18, letter-spacing 1 |

### Layout & shape
- Artboard **375 × 812**; content gutter **24px**; content width **327px**
- List card: **327 × 78**, thumbnail left, 3-line content, right-aligned price + action
- Radii: **12** (buttons, cards), **16** (search bar), **8** (price chip), **4** (handle)
- Primary CTA: 265 × 58, dark gradient fill; secondary icon button 50 × 50 outlined

## 3. Screens Adapted

| Figma frame | Was | Now | Maps to |
|---|---|---|---|
| `Onboarding` | "Explore Upcoming and Nearby Events" + EVENT wordmark | MAIDAN wordmark + "Book Padel, Futsal & Cricket Grounds" / JazzCash-Easypaisa copy | Onboarding (PRD §7) |
| `Venue Details` | Shere Bangla Concert, $299 USD, Dhaka, "Buy A Ticket" | Padel Republic DHA, Rs 5,500/hr, DHA Phase 5 Lahore, hours, owner card, "Book A Slot"; hero swapped to a padel court | **Pillar 1 — Booking** |
| `Open Matches` | See All Events (8 event cards, USD) | 8 open matches: futsal 5v5 "2 spots left", padel doubles by level, tape-ball "3 needed", box cricket, cricket nets — Lahore areas, PKR per-player prices, "JOIN NOW" | **Pillar 2 — Matchmaking** |
| `Team Challenges` *(new — cloned)* | — | 8 challenge cards: team name, sport + W/L record, proposed slot, "ACCEPT" with "Split cost / Loser pays" stake | **Pillar 3 — Challenges** |
| `Chats` | Generic DMs ("Hi :)") | Match/team/venue threads: "Ali: need a keeper!", "Challenge accepted!", "Booking confirmed ✓", Roman-Urdu "Court book kar li?" | Match & challenge coordination |

Content decisions applied throughout: **PKR pricing** (padel Rs 1,200–5,500, futsal Rs 450–700/player, cricket Rs 500–800 — all from `01-market-research.md`), **Lahore geography** (DHA Phases, Gulberg, Johar Town, Model Town, Cantt, Wapda Town), **late-night slots** (6 PM–11 PM, matching the 6 PM–3 AM peak culture), and **skill levels + spots-remaining** on every match card.

## 4. Screens Built From Scratch — page `📱 MAIDAN App`

Built natively (not adapted from the kit) on a dedicated page, using the tokens in §2:

| Frame | Contents | Why it matters |
|---|---|---|
| **01 Slot Picker** | Venue summary; 4-day date strip; 3×3 time grid with per-slot PKR pricing showing off-peak (Rs 4,000–4,500) vs peak (Rs 5,500), one greyed **Booked** slot and one selected; **"Slot held for 5:00"** notice; sticky total + CTA | The kit's Calendar screens are raster-only. Encodes the peak/off-peak pricing and the 5-minute Redis hold from `05-technical-architecture.md` §5.1 |
| **02 Checkout — Deposit Mode** | Booking summary; **deposit option selected by default** ("Rs 1,100 online now · Rs 4,400 cash at venue") vs pay-in-full; JazzCash (selected) / Easypaisa / Card; CTA reads "PAY WITH JAZZCASH" | The single most Pakistan-specific screen — answers the ~75–85% cash-on-delivery reality without abandoning no-show protection |
| **03 Create Open Match** | Sport (Futsal selected), format (5v5 / 6v6 / 7v7), players-needed stepper with "8 of 10 joined", skill level, **"Open to: Anyone / Men only / Women only"**, cost per player auto-derived (Rs 6,000 ÷ 10) | Supply side of Pillar 2. Gender preference is a market requirement, not an afterthought |
| **04 Team Profile** | Orange banner with crest, W/L record, win rate, **Lahore city rank**, squad roster with per-player **reliability %** | Completes Pillar 3 and surfaces the reliability score — the anti-no-show mechanic no local competitor has |

## 5. Gaps — Still To Design

1. **Home / discovery** — search, sport tabs, nearby venue cards, map toggle (kit's `12_Home` is raster-only)
2. **Owner dashboard (web)** — calendar with walk-in/manual bookings, earnings, payouts — no equivalent in the kit and the highest-leverage surface for supply-first GTM
3. **Join-match flow** — request → host approval → pay share (consumer side of Pillar 2)
4. **Challenge creation & result reporting** — both captains confirm score → leaderboard update
5. **Booking confirmation / ticket** with QR check-in code
6. **Urdu localization pass** — Inter lacks Urdu; pair with Noto Nastaliq Urdu and validate RTL layouts

## 6. Implementation Fidelity — What the Web App Does With These Frames

The React app in `web/` is built from the frames, not from a summary of them. Geometry was read out of Figma node-by-node and encoded in `web/src/styles.css`:

| Element | Figma | In code |
|---|---|---|
| Artboard | 375 wide, 24 gutter, 327 content | `.shell` max-width 375, `.pad` 24 |
| List card | 327×78, radius 12 | `.list-card` |
| Card thumb | 58×58, radius 10, inset 10,10 | `.list-card .thumb` |
| Card title | 14/600 at x78, y19 | `.list-card .body .name` |
| Card sub-line | 10/400 at y47, 4px orange dot separator | `.list-card .body .sub` |
| Card divider | 1px at x254, 38 tall | `.list-card .divider` |
| Card right col | price 10/600 orange over action 10/600 ink, 16 from right | `.list-card .right` |
| Chat row | 45px avatar, 14/600 title, 14/400 preview, 12/400 time | `.chat-row` |
| Unread badge | 16×16, radius 8, `#29D697` | `.chat-row .unread` |
| Venue hero | 395 tall, 20% black scrim | `.hero` |
| Bottom bar | 112 tall, CTA 56 (fixed 175 on Checkout) | `.bottombar`, `.btn` |
| Onboarding panel | 375×312 orange, copy column inset 56 | `.onboard .panel` |
| Tab bar | icon-only, 24px Iconly glyphs, active filled orange + 26×3 indicator on the top edge | `.tabbar`, `.tab`, `src/icons.tsx` |
| Home hero | dark block: avatar + greeting, current city, search + filter | `.hero-dark`, `.hero-search` |
| Media card | photo at radius 12, favourite toggle, orange fact icons, CTA pill | `.media-card`, `MediaCard` |
| Horizontal rail | snap-scrolling row lifted over the hero | `.rail`, `.pull-up` |
| Segmented control | pill track, active segment white with orange label | `.segmented` |
| Category tiles | 48px pill, photo or icon in a 32px circle | `.cats`, `.cat` |

### Component library

Shared pieces live in `web/src/components/` rather than being re-declared per screen:

| Component | From | Notes |
|---|---|---|
| `AppBar` | every frame | Centred 20/600 title, back arrow, up to two trailing action icons with optional badge |
| `MediaCard` | `12_Home`, `19_Event- Upcoming` | Photo, favourite toggle, orange fact rows, footer + CTA pill |
| `ListCard` | `16_See All Events` | The 327×78 row |
| `Sheet` | `25_Filter` | Bottom sheet with scrim, drag handle and a footer action bar |
| `FilterSheet` | `25_Filter` | Sport chips, time pills, calendar/location fields, price ceiling, Reset/Apply |
| `Field` | `25_Filter` | White row with an orange lead icon and a chevron |
| `PillGroup` | `25_Filter` | Peach pills that fill orange when selected |
| `Segmented` | `19_Event- Upcoming` | Two-up tab track |
| `EmptyState` | `17_Empty Events` | Glyph in a wash circle, title, body, optional CTA |
| `CountBadge` | `32_Notification` | Count chip beside a section label |
| `AvatarStack`, `Thumb` | cards throughout | Overlapping chips; 58×58 photo with monogram fallback |

### Profile, Challenges and Chats

- **Profile** (`48_Profile`) — a 108px avatar with an orange edit badge, the name, a three-up stat row divided by hairlines, an About paragraph and interest chips. The frame's stats are Followers / Following / Events; ours are **Games / Reliability / Teams**, because those are the numbers this product actually has. Everything below the fold is ours: the template's profile is a dead end, and the app needs routes into bookings, the team and notifications. Reliability comes from the derived score, so the About copy changes tone above and below 90%.
- **Chat thread** (`35_Chat`) — header with avatar, online dot, name and subtitle plus search/more; a grey conversation area with a date divider and per-group timestamps; orange bubbles right for your own messages, white left for theirs, with the corner nearest the screen edge squared off; a rounded composer. Sending appends to the thread so the interaction is real rather than a static mock. The tab bar hides while a conversation is open, as the frame does.
- **Challenges** — the kit has no challenge frame, so this composes existing vocabulary rather than inventing a new one: the segmented control from the Events frame (Open board / Our matches), a **versus card** built on the same card shell with two crests either side of a VS, and the Filter sheet's pill/field language for posting a challenge and reporting a score. Score entry is two large number fields; the copy states plainly that the leaderboard only moves when both captains agree.
- **My Bookings** — the kit's Upcoming / Past split applied to the player's own bookings, with what is still owed at the counter and a route back into the ticket.

### Screens added in this pass

- **Notifications** (`32_Notification`) — Unread / Earlier groups with count chips, avatar rows reading "**Name** did thing", and Reject / Accept on anything awaiting a decision. Reached from the bell in the Home hero, which carries an unread dot.
- **Ticket** (`45_Ticket`) — replaces the plain confirmation. An orange card wrapping the venue photo over a white stub with a Date / Time / Court / Paid grid, a perforated edge with circular side notches, and a scannable code derived from the booking id (stable per booking, not random). Would become a QR in a real build.
- **Filter sheet** (`25_Filter`) — opened from the Home hero's filter button; applies a sport and a price ceiling to the list.

### Two card types, not one

The kit uses **two** card patterns and the app now carries both:

1. **Compact list card** — 327×78, from `16_See All Events`. Used on the All Grounds list and the challenge board.
2. **Large media card** — from `12_Home`'s rail and `19_Event- Upcoming`. A photo with a favourite toggle, a title, orange-iconed fact rows, then a footer of avatars, price and the primary action. Used on Home and Open Matches.

The first pass only had the compact card, which is why Home and Matches read as plain lists rather than the designed screens.

### Tab bar icons

The frames use the **Iconly** set (`Iconly/Light-Outline/Bookmark`, `Iconly/Bold/Call`, `Iconly/Bold/Chat` appear as named layers). `src/icons.tsx` draws matching glyphs as inline SVG at 24×24 with a 1.6px stroke, round caps and joins:

- **Inactive** — Light-Outline weight, `#9A9BA2`
- **Active** — Bold weight (filled silhouette), brand orange, plus a 26×3 orange bar sitting on the nav's top edge

Three of the five reuse the design's own icons (home, calendar, profile); challenges and chats extend the same set (trophy, chat bubble). Labels are omitted because the frame's nav is icon-only — each button carries an `aria-label` and `title` instead.

> Emoji were used as placeholders in the first pass. They are not a substitute for an icon set: they render differently per platform, ignore `currentColor`, and read as unfinished.

### Icons and imagery elsewhere

The same rule applies across every screen — no emoji anywhere in the interface. `src/icons.tsx` covers the full set the frames call for: `arrow-left`, `heart`, `bookmark`, `location`, `clock`, `call`, `chat`, `search`, `tick`, `timer`, `users`, plus the five nav glyphs. Each takes a `size` and, where the frame distinguishes states, a `bold` variant:

| Was | Now |
|---|---|
| `←` back arrow | `arrow-left`, 22px |
| `📍` / `🕘` on Venue Details | `location` / `clock`, 14px, muted |
| `💬` / `📞` owner buttons | `chat` / `call`, 19px, in 40px circles |
| `❤️` / `🤍` and `🔖` / `📑` | `heart` / `bookmark`, outline ↔ bold on toggle |
| `🔍` in the Chats search bar | `search`, 18px |
| `⏱` hold-timer note | `timer`, 14px |
| `✓` confirmation | `tick`, 40px bold |

**Card thumbnails are photographs, not glyphs.** The frame's card carries a 58×58 `Image` node at radius 10, so `Thumb` renders the venue photo (`venues.photo_url`, exposed on both the list and the matches feed). Records that genuinely have no photo — teams — fall back to a monogram on a tint derived from the record's id, so a given team always gets the same colour. Onboarding leads with a photograph of the sport for the same reason: the frame's bespoke illustration has no source file, and a photo is closer to the product than a stock glyph.

**Deliberate deviations, and why:**

1. **Flow layout instead of absolute positioning.** Figma positions every node absolutely; the app uses normal flow with the same sizes and spacing, because real content varies in length and the screens must scroll.
2. **No Sport selector on Create Match.** The frame has one, but in the real flow the sport is fixed by the court you already booked, so offering it would let a user post a futsal match on a padel court. Format options adapt to the sport instead.
3. **Rounded top corners on the venue sheet and onboarding panel.** The exported frames render with rounding; the underlying rectangles report no `cornerRadius`. Matched the render.
4. **Three oranges, and never white text on the brand orange.** `#F76B10` carries 2.97:1 against white — below WCAG AA at every size, including the 3:1 large-text floor. One orange cannot serve as both a fill and a text colour, so:

   | Token | Value | Use | Ratio |
   |---|---|---|---|
   | `--orange` | `#F76B10` | Fills, icons, indicators — **never** behind white text | — |
   | `--orange-ink` | `#C4530A` | Small orange text on white | 4.58:1 |
   | `--orange-deep` | `#B84E09` | Small orange text on `--orange-wash` | 4.76:1 |

   Anything sitting **on** an orange fill — selected slots and chips, accent buttons, the notification count, the avatar-stack overflow — takes `--ink` (`#20222C`), which is 5.33:1 on `#F76B10`. This keeps the design's exact brand orange as the fill while making the text legible; the alternative, darkening the fill until white passes, would have changed every orange surface in the app.

   The selected-slot case drove the decision: that chip carries the time and the price the user is about to pay, and at 2.97:1 it washed out in daylight exactly when it mattered most.

   Same rule for the Chats unread badge: white on `--green` `#29D697` is 1.88:1, the worst pairing in the file. It now uses `--ink` (8.41:1).
5. **Compact time format on cards.** The frame's sub-line reads "Tonight, 9 PM"; a full date ("Wed, 26 Aug, 10:00 pm") overflows the 176px text column. `formatSlotShort()` produces the design's shorter form.
6. **Venue photos required a schema change.** The hero is central to the frame, so `venues.photo_url` was added (migration `002_venue_photos.sql`) rather than shipping a placeholder.

**Screens with no Figma source:** Discover and Booking Confirmation. The kit's Home frame is a flattened image, so Discover reuses the list card and chips from frames that do exist; Confirmation was composed from the same primitives.

## 7. Notes & Recommendations

- **Formalize tokens before building more screens.** Publish the colors and text styles above as Figma styles and convert the list card, price chip, CTA, and divider into components — the kit ships none, so every screen currently duplicates raw layers.
- **Add a dark theme.** Venues are booked at night; the kit's `12_Home` preview shows a dark variant already, so the palette supports it.
- **`--muted` was too light.** `#73757D` on the app's `#FBFBFB` surface is 4.44:1 — just under AA, and it is the colour of every secondary line in the app (empty states, hints, card sub-text, the "Cancelled" badge). Now `#65676F`: 5.45:1 on the surface, 4.94:1 on `--line-soft`.
- **Push the contrast rule back into Figma.** The three-orange split above lives only in `styles.css`. Publish `--orange-ink` and `--orange-deep` as Figma styles so a new frame cannot reintroduce white-on-orange.
- **Controls that do nothing should not render.** Several frames include trailing "more options" icons, a calendar field and owner call/message buttons with nothing behind them. Rendered as real buttons they take focus and announce a name to a screen reader, which is worse than their absence — `AppBar` now drops actions with no handler, and `Field` renders as plain content unless given one.
- **Template wordmark** was hidden (not deleted) at layer "Event Illustration" on the Onboarding frame — unhide it to revert branding.
- Bulk text edits over ~20 nodes time out against the Figma plugin bridge; batch them in groups of ~15.
