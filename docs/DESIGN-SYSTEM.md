# M-Chef Design System — Reusable Visual Language for Operational Intelligence Apps

> **Author role:** Top Design Director
> **Scope:** A complete, adaptive design system distilled from the M-Chef UI Concept (hospitality & food service industry) — usable to re-skin **any** operational intelligence, dashboard, analytics, or SaaS product to the same quality bar.
> **Source images:** 5 reference boards covering mobile app screens, desktop dashboard, marketing page, and a gallery of components.
>
> This document is the canonical design law for visual, interaction, and component decisions. When code disagrees with this file, this file wins.

---

## Table of Contents

1. [Design Philosophy & Brand Personality](#1-design-philosophy--brand-personality)
2. [Brand Voice & Personality Traits](#2-brand-voice--personality-traits)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Iconography](#5-iconography)
6. [Spacing, Grid & Layout](#6-spacing-grid--layout)
7. [Corner Radius & Shape Language](#7-corner-radius--shape-language)
8. [Elevation, Depth & Surface Treatment](#8-elevation-depth--surface-treatment)
9. [Borders, Strokes & Dividers](#9-borders-strokes--dividers)
10. [Motion & Micro-interactions](#10-motion--micro-interactions)
11. [Component Library](#11-component-library)
12. [Mobile Patterns (Phone-First)](#12-mobile-patterns-phone-first)
13. [Desktop / Web Dashboard Patterns](#13-desktop--desktop-web-dashboard-patterns)
14. [Data Visualization Style](#14-data-visualization-style)
15. [Illustration Style](#15-illustration-style)
16. [Marketing / Landing Page Patterns](#16-marketing--landing-page-patterns)
17. [Empty, Loading, Error & Success States](#17-empty-loading-error--success-states)
18. [Voice, Tone & Microcopy](#18-voice-tone--microcopy)
19. [Accessibility Requirements](#19-accessibility-requirements)
20. [Responsive & Adaptive Rules](#20-responsive--adaptive-rules)
21. [Adapting the System to Other Apps](#21-adapting-the-system-to-other-apps)
22. [Quick-Start Recipe for a New App](#22-quick-start-recipe-for-a-new-app)
23. [Anti-Patterns (What NOT to do)](#23-anti-patterns-what-not-to-do)
24. [Token Reference (Copy-Paste Ready)](#24-token-reference-copy-paste-ready)

---

## 1. Design Philosophy & Brand Personality

### Core identity
**Bold, confident, slightly playful, data-first.** The M-Chef system feels like a senior ops manager who is also a designer: never apologetic, never boring, never cluttered. Every screen has a clear hero (one big number, one big chart, one big CTA) surrounded by calm supporting cast.

### The three operating principles

| Principle | What it means |
|---|---|
| **Hero-first composition** | Every screen has one dominant element that earns the user's first glance. Everything else is supportive. |
| **Calm within energy** | Bright accents and personality are allowed — but applied as accents, not as a wallpaper. Backgrounds stay neutral so data breathes. |
| **One-look comprehension** | A user should understand what a screen is *about* in < 2 seconds. If they have to scan to find the point, the layout is wrong. |

### Five personality words
- **Direct** — no decorative copy, no padding-for-padding's-sake.
- **Confident** — big numbers, generous type, no hedging.
- **Warm** — human illustration, soft primary colors (coral, butter yellow, lavender), not cold enterprise blue.
- **Operative** — every element earns its place by helping the user decide or act.
- **Slightly playful** — illustrations, friendly microcopy, personality icons — but never at the cost of clarity.

### What the system is NOT
- Not Material Design. Not iOS Human Interface Guidelines. It borrows from both but follows neither.
- Not "enterprise gray with blue accents." It has range: coral, butter, lavender, mint — used semantically.
- Not minimalist to the point of sterile. The illustrations and color blocks keep it human.
- Not maximalist. The energy comes from a single hero on each surface, not from visual noise.

---

## 2. Brand Voice & Personality Traits

### Voice attributes
| Trait | Do | Don't |
|---|---|---|
| Confident | "Approve critical alerts and check inventory risk." | "You may want to consider reviewing your alerts." |
| Direct | "Shift ends in 2:59:12 hours." | "The shift will be ending in approximately three hours." |
| Warm | "Hi, Hanna!" | "Welcome back, User #4582." |
| Slightly playful | "Stop analyzing and start acting." | "Unlock your operational potential today." |
| Honest | "Labor Cost is 28%." | "Optimize your labor for peak performance!" |

### Copy principles
- Lead with **the insight**, not the topic. "Labor Cost is up 28%" beats "Labor Cost Report."
- Always include a **next action** when showing a state. "Hi! → Show labor cost → Initiate strategy planning."
- Numbers are **specific**, never rounded for show. `$21,150.88` beats `$21K`.
- Errors are human and **actionable**: "Couldn't reach the data service — Retry" beats `Error 503`.
- Time urgency without anxiety: "Shift ends in 2:59:12 hours" (informational) not "URGENT! SHIFT ENDING!" (alarming).

---

## 3. Color System

### 3.1 Philosophy
A **neutral-canvas + vibrant-accent** system. Backgrounds are warm off-white or true-dark; data and CTAs carry the personality. The system uses **~6 functional colors** at any time: surface, text, accent, success, warning, danger. Brand pastels (butter yellow, lavender, mint) are used as **section backgrounds**, never as text or icons.

### 3.2 Surface tokens (the canvas)

```
/* Light theme */
--surface-canvas:        #ECEFE6   /* warm light gray-green, app background */
--surface-card:          #FFFFFF   /* card / sheet background */
--surface-card-muted:    #F4F1EA   /* warm cream, secondary cards */
--surface-elevated:      #FFFFFF   /* modals, popovers, tooltip */
--surface-inverse:       #0E0F12   /* dark sections on light theme (rare) */
--surface-overlay:       rgba(14, 15, 18, 0.55)   /* modal scrim */

/* Dark theme */
--surface-canvas:        #0E0F12   /* near-black, not pure #000 */
--surface-card:          #18191C   /* card on dark */
--surface-card-muted:    #222428   /* secondary card */
--surface-elevated:      #25272B   /* popovers */
--surface-overlay:       rgba(0, 0, 0, 0.65)
```

**Rules:**
- Never use pure white `#FFFFFF` or pure black `#000` for app backgrounds. They glare and feel sterile.
- Light surface has a subtle warm tint (greenish/cream) — not gray-blue, which feels corporate-cold.
- Dark surface is a true dark, not OLED black, to reduce "smear" perception.

### 3.3 Text tokens

```
--text-primary:          #0E0F12   /* on light: near-black */
--text-secondary:        #5C6068   /* on light: medium gray */
--text-tertiary:         #8E929B   /* on light: light gray (timestamps, helper) */
--text-inverse:          #F4F1EA   /* on dark: warm off-white */
--text-inverse-muted:    #B5B8BF

/* Dark mode */
--text-primary:          #F4F1EA
--text-secondary:        #B5B8BF
--text-tertiary:         #7A7E87
```

**Rules:**
- Default body text is `--text-primary`. Reserve secondary for timestamps and metadata. Tertiary is for placeholders only.
- Contrast ratios: primary text ≥ 7:1 (AAA), secondary ≥ 4.5:1 (AA), tertiary ≥ 3:1 for large text only.
- Never use color to carry meaning without an additional cue (icon, label, weight).

### 3.4 Brand accent palette (the personality)

The M-Chef system uses **distinct named hues** to give sections and categories identity. Each accent has a **bg + fg + on-color** triple so they can be used as full-bleed sections.

```
/* Coral — primary brand, CTAs, revenue, hero data */
--accent-coral-bg:       #FF5C44
--accent-coral-bg-soft:  #FFE3DC   /* tint for tags, soft sections */
--accent-coral-fg:       #FFFFFF
--accent-coral-text:     #C8341B   /* on soft bg */

/* Butter — secondary, mild alerts, "soon" states */
--accent-butter-bg:      #F5C84C
--accent-butter-bg-soft: #FFEFC5
--accent-butter-fg:      #0E0F12
--accent-butter-text:    #6B4F00

* Lavender — info, capacity, neutral-positive
--accent-lavender-bg:    #B5A6FF
--accent-lavender-bg-soft: #E4DDFF
--accent-lavender-fg:    #FFFFFF
--accent-lavender-text:  #4433B5

* Mint — success, healthy metrics
--accent-mint-bg:        #7FE3B0
--accent-mint-bg-soft:   #D6F5E5
--accent-mint-fg:        #0E0F12
--accent-mint-text:      #1B6B45

* Ink — neutral primary CTA on light (text + buttons)
--accent-ink-bg:         #0E0F12
--accent-ink-fg:         #FFFFFF
```

**Rules:**
- **Coral = primary CTA**, revenue, dominant metric, "Act now."
- **Butter = caution, "in progress," warmth.**
- **Lavender = informational, capacity, neutral-positive.**
- **Mint = success, healthy, completed.**
- **Ink = neutral action** (Settings, Cancel, secondary button).
- Maximum **one bright accent** per screen as the dominant. Others appear as supporting tags, chips, or small badges.
- Pastel **bg-soft variants** are used for full-bleed section panels and tag backgrounds. They are NEVER text colors.
- Never use a brand color for body text. Body text stays on the ink/text scale.

### 3.5 Semantic colors (state, not brand)

```
--state-success:         #1F9E5A   /* green for "approved," "connected" */
--state-success-bg:      #E5F6EC
--state-warning:         #C97A0F   /* amber for "approaching limit," "pending" */
--state-warning-bg:      #FFF1DC
--state-danger:          #D62E2E   /* red for "critical," "disconnected," errors */
--state-danger-bg:       #FCE4E4
--state-info:            #2A5BD7   /* blue for informational notices */
--state-info-bg:         #E2EAFB
```

**Rules:**
- These are the **only** colors that may be used for status indicators (badges, dot icons, alert icons).
- Never use brand coral/butter/lavender for "danger" — that dilutes their meaning.
- Pair every state color with an **icon + label**, never color alone.

### 3.6 Color usage ratios (per screen)

A typical screen should distribute roughly:
- **70%** neutral surfaces (canvas, cards, muted)
- **20%** text (primary + secondary)
- **7%** single brand accent (coral/butter/lavender as hero)
- **3%** other accents / state colors

If a screen has more than ~10% bright color, it's over-designed.

### 3.7 Theming rules

- **Light is default.** Dark is offered as a user setting, not a marketing differentiator.
- **No auto-cycle** based on time-of-day unless the user opts in.
- **No high-contrast "AAA" toggle** in v1 — design for AA by default; AAA for hero text and reading surfaces.
- **Pastel sections remain pastel** in dark mode — invert only the canvas/text, not the brand hues. The hero card on the dashboard stays coral in both modes.

---

## 4. Typography

### 4.1 Type families

| Role | Family | Notes |
|---|---|---|
| Display / Headings | **Inter** (800/700) | Tight, modern, neutral. Used at very large sizes for hero numbers and section titles. |
| UI / Body | **Inter** (400/500/600) | The workhorse. All buttons, labels, body, navigation. |
| Numerals / Data | **Inter** with tabular figures | Use `font-variant-numeric: tabular-nums` for any column of numbers, time, currency. |
| Marketing display | **Inter** 900, uppercase | The "STOP ANALYZING AND START ACTING" hero uses ultra-bold, condensed-feel, uppercase. |
| Mono (rare) | **JetBrains Mono** | Only for code-like strings: IDs (RCD-4482), JSON, technical logs. |

**Rules:**
- A single family (Inter) covers almost everything. Do not introduce a second sans (e.g. no SF Pro, no Roboto) — it dilutes identity.
- No serifs. The brand reads as modern, not literary.
- Tabular figures are **mandatory** in tables, charts, KPIs, time displays.

### 4.2 Modular type scale

All type is sized from a single modular scale (1.250 minor third), with display sizes breaking out for hero moments.

```
--font-size-xs:    11px     /* micro labels, chip text */
--font-size-sm:    13px     /* secondary metadata, helper text */
--font-size-base:  15px     /* body, default UI text */
--font-size-md:    17px     /* emphasized body, button text */
--font-size-lg:    20px     /* section titles, card titles */
--font-size-xl:    28px     /* page H1 */
--font-size-2xl:   36px     /* dashboard hero card title */
--font-size-3xl:   48px     /* big KPI number */
--font-size-display: 80px   /* marketing hero only */
--font-size-mega:    120px  /* landing display only */
```

**Fluid sizing (recommended):**
```css
font-size: clamp(15px, 0.9vw + 13px, 17px);   /* body */
font-size: clamp(36px, 4vw + 20px, 48px);     /* KPI */
```

### 4.3 Weight & case

| Weight | Usage |
|---|---|
| 400 (Regular) | Body, descriptions, helper text |
| 500 (Medium) | Labels, button text, emphasized body |
| 600 (Semibold) | Card titles, list-item primaries, KPI labels |
| 700 (Bold) | Section H2/H3, large KPI numbers |
| 800 (ExtraBold) | Page titles, dashboard hero card titles |
| 900 (Black) | Marketing display headlines, "STOP ANALYZING" |

**Case rules:**
- **ALL CAPS** reserved for: section eyebrows (REVENUE, WORKERS, POINTS), KPI labels (`GROSS REVENUE`), tab labels when short (SHOP, FEATURES).
- **Title Case** for: card titles, modal titles, navigation items.
- **Sentence case** for: body, descriptions, button labels ("Initiate strategy planning").
- Mixed case in a single phrase is a smell — pick one.

### 4.4 Line height & measure

```
--line-height-tight:  1.05   /* display, marketing */
--line-height-snug:   1.2    /* large headings */
--line-height-normal: 1.4    /* UI labels, button text */
--line-height-relaxed: 1.5   /* body */
--line-height-loose:  1.65   /* long-form body, descriptions */
```

**Rules:**
- Display headlines use **1.05–1.1** to feel monumental.
- KPI numbers use **1.0–1.1** (tight, dramatic).
- UI labels (button, chip, tab): **1.2–1.4**.
- Body / descriptions: **1.5**.
- Measure (line length): **45–70 characters** for descriptive text. Headlines can break any time.

### 4.5 Tracking (letter-spacing)

```
--tracking-tightest:  -0.04em   /* mega display */
--tracking-tight:     -0.02em   /* large headings, KPI numbers */
--tracking-normal:    0         /* body, UI */
--tracking-wide:      0.04em    /* small caps, eyebrows */
--tracking-widest:    0.12em    /* uppercase eyebrows ("REVENUE") */
```

**Rules:**
- Display text gets **negative tracking** for tightness.
- ALL CAPS eyebrows always get **0.08–0.12em positive tracking** to breathe.
- Never tighten small text — it hurts readability.

### 4.6 Numerals

- **Tabular figures** (`font-feature-settings: 'tnum' 1`) on all data: revenue, percentages, time, IDs, counts.
- **Currency:** `$21,150.88` — no space, period decimal, comma thousand. Match user locale but default to en-US formatting.
- **Large hero numbers** often have **2 colors**: the integer in `--text-primary`, the decimal/fraction in `--text-tertiary`, both tabular, often on a colored accent background.

---

## 5. Iconography

### 5.1 Style
**Outlined, 1.5–2px stroke, rounded caps & joins.** Icons feel friendly but precise. Size typically **20px** in UI, **24px** in navigation, **16px** inline. Never filled-only — always paired with a label in the same control for clarity.

### 5.2 Icon library recommendation
- **Lucide** (primary) — clean, geometric, matches Inter's tone.
- **Phosphor** (alternative) — slightly warmer, more rounded.
- Custom-drawn accents for brand marks only (e.g. the M-Chef "M" character).

### 5.3 Icon rules
- Stroke weight matches the text weight it's next to (medium icons next to medium text).
- Icon + label pairs are the **default**. Icon-only is reserved for: toolbars, table actions, navigation tabs (with an active state).
- Active/selected icons may **fill** while inactive stay outlined (e.g. the home tab).
- Icons never carry brand color for decoration. Use `--text-primary` for default, `--accent-coral` only for active state, `--state-*` for semantic states.
- **Status icons** are always paired with a colored dot or background chip — never just a colored icon.

---

## 6. Spacing, Grid & Layout

### 6.1 Spacing scale (4px base)

```
--space-0:    0
--space-1:    4px
--space-2:    8px
--space-3:    12px
--space-4:    16px
--space-5:    20px
--space-6:    24px
--space-7:    32px
--space-8:    40px
--space-9:    48px
--space-10:   64px
--space-11:   80px
--space-12:   96px
```

**Rules:**
- All spacing must come from this scale. No orphan 5px, 13px, 22px.
- Component padding uses `--space-4` (16) or `--space-5` (20). Card padding: `--space-6` (24).
- Section spacing: `--space-8` (40) to `--space-10` (64).

### 6.2 Mobile grid
- Outer gutter: `--space-4` (16px) on phone, `--space-6` (24px) on tablet.
- Content max-width: **full bleed** with inner padding. Single-column by default.
- Two-column allowed for compact data (e.g. settings rows with label/value).
- Sticky bottom safe-area inset respected on iOS/Android.

### 6.3 Desktop / dashboard grid
- **Sidebar:** fixed `--sidebar-w: 72px` (icon-only collapsed) or `--sidebar-w: 240px` (expanded).
- **Main column:** fluid, max-width **1440px**, gutter `--space-8` (40).
- **Dashboard card grid:** 12-column, 24px gap, cards span 4/6/8/12 columns.
- Hero card (Revenue, AI Lead): **6 columns** (50%). Secondary cards: **4 columns**. Wide chart: **12 columns**.

### 6.4 Page layout pattern (mobile)
1. Status bar (system)
2. Sticky header with primary nav + venue/context switcher (height ~56px)
3. Hero card (full-width, 1x bright accent)
4. Stacked secondary cards (full-width, neutral)
5. Sticky bottom tab bar (5 items max, home active state)
6. FAB (floating action button) when primary action exists

### 6.5 Page layout pattern (desktop dashboard)
1. Top bar: brand mark + global search + venue switcher + user avatar (height 64px)
2. Left sidebar: vertical icon nav (72–240px wide, collapsible)
3. Main scroll area: greeting row → hero row (Revenue 6col + AI Lead 6col) → secondary row (4 cards × 3) → wide chart row (12col) → table row (12col)
4. Right rail (optional): notifications, contextual suggestions (320px)

---

## 7. Corner Radius & Shape Language

### 7.1 Radius scale

```
--radius-xs:   6px      /* chips, tags, small badges */
--radius-sm:   10px     /* inputs, small buttons */
--radius-md:   16px     /* standard buttons, small cards, dropdowns */
--radius-lg:   20px     /* standard cards (most common!) */
--radius-xl:   28px     /* hero cards, sheets, large panels */
--radius-2xl:  36px     /* modals, big feature panels */
--radius-full: 9999px   /* pills, avatars, FABs */
```

### 7.2 Rules
- **Default card radius: 20px** (`--radius-lg`). Cards feel substantial, not boxy.
- **Buttons: 16px** (`--radius-md`) for rectangular; full pill for tag-style.
- **Modals & sheets: 28px** top corners only on mobile bottom sheets.
- **Inputs: 14–16px** to feel friendly, not severe.
- **Avatars & status dots: full circle.**
- **FAB (floating action): 28px** (square-with-rounded-corners) — not a circle. This is a key differentiator from Material Design.
- Never mix radii in a single component (e.g. card with 16px top + 28px bottom looks broken).

### 7.3 Shape language
The system uses **rounded-rectangle cards** consistently. There are no sharp corners anywhere except tiny label pills. Even icons sit in soft rectangular containers (e.g. venue icons in 16px-radius squares).

---

## 8. Elevation, Depth & Surface Treatment

### 8.1 Elevation principles
- Most "depth" comes from **color contrast and surface differentiation**, not drop shadows.
- A white card on a warm-gray canvas already reads as elevated.
- Shadows are used **sparingly**, only for floating elements: dropdowns, popovers, modals, FAB.

### 8.2 Shadow tokens

```
--shadow-xs:  0 1px 2px rgba(14, 15, 18, 0.04);
--shadow-sm:  0 2px 6px rgba(14, 15, 18, 0.06), 0 1px 2px rgba(14, 15, 18, 0.04);
--shadow-md:  0 6px 16px rgba(14, 15, 18, 0.08), 0 2px 4px rgba(14, 15, 18, 0.04);
--shadow-lg:  0 12px 32px rgba(14, 15, 18, 0.12), 0 4px 8px rgba(14, 15, 18, 0.06);
--shadow-xl:  0 24px 56px rgba(14, 15, 18, 0.18), 0 8px 16px rgba(14, 15, 18, 0.08);
--shadow-focus: 0 0 0 3px rgba(255, 92, 68, 0.35);   /* coral focus ring */
```

### 8.3 Rules
- **Cards in a list/grid: no shadow, or `--shadow-xs` max.** Borders + color separation do the work.
- **Floating menus/dropdowns: `--shadow-md`.**
- **Modals & sheets: `--shadow-xl`** plus a 55% dark scrim.
- **FAB: `--shadow-md`**, lifts to `--shadow-lg` on press.
- **Dark mode shadows are deeper** (`rgba(0,0,0,0.4)` base) to read against dark canvas.

### 8.4 Surface treatment extras
- **Color blocks (hero cards, pastel sections):** flat color, no gradient, no texture.
- **Chart fills:** subtle gradient from accent color (60% opacity) to transparent.
- **Glassmorphism is NOT used.** No backdrop blur, no translucent panels. The system commits to solid surfaces for legibility.

---

## 9. Borders, Strokes & Dividers

### 9.1 Border tokens

```
--border-subtle:   1px solid rgba(14, 15, 18, 0.06);   /* card edges on light */
--border-default:  1px solid rgba(14, 15, 18, 0.10);   /* input borders */
--border-strong:   1px solid rgba(14, 15, 18, 0.18);   /* emphasized */
--border-inverse:  1px solid rgba(255, 255, 255, 0.10); /* on dark */
--border-accent:   1px solid var(--accent-coral-bg);   /* focused/active */
```

### 9.2 Rules
- **Cards:** prefer **no border** + slightly raised surface (or a colored hero background). When border is needed, use `--border-subtle`.
- **Inputs:** `--border-default`, focus → 2px `--border-accent` (coral).
- **Dividers** between list rows: 1px `--border-subtle` OR `--space-3` of vertical space, never both.
- **Active nav item:** left bar 3px in accent color + tinted background.
- Dark mode borders always use **rgba(255,255,255,...)** for contrast against dark.

---

## 10. Motion & Micro-interactions

### 10.1 Motion principles
- Motion **communicates state change**, never decorates.
- All motion is **fast and confident** — no bouncing, no rubber-banding, no parallax.
- Respect `prefers-reduced-motion`: disable non-essential motion (transitions remain ≤80ms).

### 10.2 Timing tokens

```
--duration-instant:   80ms    /* hover color, focus ring */
--duration-fast:      150ms   /* button press, small state change */
--duration-base:      220ms   /* default transition (cards, modals) */
--duration-slow:      320ms   /* page transitions, large sheets */
--duration-deliberate: 480ms  /* hero card entrance, chart draw */
```

### 10.3 Easing

```
--ease-out:        cubic-bezier(0.2, 0.8, 0.2, 1)       /* default for entrances */
--ease-in:         cubic-bezier(0.6, 0, 0.8, 0.2)       /* exits */
--ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1)         /* state toggles */
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1)    /* playful pops, sparingly */
```

### 10.4 What to animate
| Element | Animation | Duration | Easing |
|---|---|---|---|
| Button press | Scale 0.97 + bg darken | 80ms | ease-out |
| Modal/sheet open | Slide up 16px + fade | 220ms | ease-out |
| Modal/sheet close | Slide down 8px + fade | 180ms | ease-in |
| Tab change | Content crossfade | 150ms | ease-in-out |
| Card hover (desktop) | TranslateY -2px + shadow up | 150ms | ease-out |
| KPI number update | Number tween (count-up) | 480ms | ease-out |
| Chart bar/draw | Width or path tween | 600ms | ease-out |
| Toast notification | Slide in from top | 220ms | ease-out |
| Loading shimmer | Background-position sweep | 1200ms loop | linear |
| Page transition | Fade + small Y shift | 220ms | ease-out |

### 10.5 What NOT to animate
- Carousels (auto-rotating)
- Bouncing icons on load
- Parallax scrolling
- Long easing (>500ms) for UI changes — feels laggy
- Spinning loaders for operations <400ms (use opacity dim instead)

---

## 11. Component Library

This is the **complete component vocabulary** of the system. Each component has a clear role, a default state, and a documented set of variants.

### 11.1 Buttons

**Primary (Coral)**
- Background: `--accent-coral-bg`. Text: `--accent-coral-fg` (white).
- Height: 48px desktop, 48–52px mobile (Fitts-friendly).
- Padding: 20px horizontal. Radius: 16px.
- Label: medium 15px, sentence case, optional leading icon (20px).
- Hover: darken 6%. Active: scale 0.97. Focus: 3px coral ring.

**Secondary (Ink/Neutral)**
- Same dimensions. Background: `--surface-card`. Border: `--border-default`. Text: `--text-primary`.

**Ghost (Text-only)**
- No background. Text: `--text-primary`. Hover: bg `rgba(14,15,18,0.04)`. Used for tertiary actions.

**Icon Button**
- 40×40px square. Radius: 12px. Icon centered. Same color logic as primary/ghost.

**Tag/Chip (Pill)**
- Height: 28px. Radius: full. Padding: 0 12px. Text: 12–13px medium.
- Variants: neutral (gray bg), success, warning, danger, info, accent (coral/butter/lavender).

**CTA Stack**
- On mobile, primary CTA is **full-width** at the bottom or in a sticky bar.
- On desktop, primary CTA is inline; secondary is to its right with `--space-3` gap.

### 11.2 Inputs

**Text Field**
- Height: 48px. Radius: 14px. Padding: 0 16px.
- Background: `--surface-card-muted` (slight tint) or white.
- Border: 1px `--border-default`. Focus: 2px coral.
- Label: floats above (12px) when focused/filled. Helper: 12px below in tertiary text.
- Error: red border + red helper + leading error icon.

**Search Field**
- Special variant: leading magnifier icon, "Search by name or ID" placeholder, trailing voice-icon button (small pill). Muted background, looks "calm."

**Select / Dropdown**
- Same dimensions as text field. Trailing chevron. Selected state shown in the closed field.

**Switch (Toggle)**
- 44×24px pill. Knob 18×18. Active: coral knob on coral track. Inactive: gray track.

**Checkbox / Radio**
- 20×20. Coral fill when checked. 2px border default.

### 11.3 Cards

**Standard Card**
- Background: `--surface-card`. Radius: 20px. Padding: 24px.
- Often features a **top accent strip** (3–6px tall, full width) in a brand color when the card is "the hero."
- Optional **iconography** in top-left (28px square, 8px radius, tinted bg matching the accent).
- Title: 16–18px semibold. Body: 14–15px regular secondary text.

**Hero Card (Revenue / KPI)**
- Background: brand accent (coral, lavender, butter).
- Title: 13px uppercase, white/dark text on accent, letter-spacing 0.12em.
- Hero number: 36–48px extrabold, tabular figures, white/dark.
- Secondary metric: smaller, on same accent, slightly transparent.
- Embedded chart: light-colored strokes/fills inside.

**Stat Card (small KPI)**
- Compact (180–220px wide). Single big number + label + delta indicator.
- Used in 3-up or 4-up grids on dashboard.

**List Card (Row List)**
- Full-width list with rows separated by hairline dividers OR 12px gaps.
- Each row: 56–72px tall. Leading icon/avatar, primary text, secondary metadata, trailing action/chevron.

**Integration Card**
- Brand mark + name + connection status.
- Status badge on right: "Connected" (mint), "Disconnected" (danger).

### 11.4 Navigation

**Top Bar (Mobile & Desktop)**
- Height: 56–64px. Background: canvas or card. Bottom hairline border.
- Left: back button (mobile) or brand mark + breadcrumb (desktop).
- Center: page title (mobile) or page title + context (desktop).
- Right: actions (search, filter, refresh, avatar).

**Bottom Tab Bar (Mobile)**
- 5 tabs max. Height: 64–72px + safe-area inset.
- Active tab: filled icon + accent color label. Inactive: outline icon + secondary text.
- Background: card with top hairline. Subtle shadow on scroll-up.

**Sidebar (Desktop)**
- Width: 72px collapsed (icons only) or 240px expanded (icon + label).
- Active item: 3px accent left-border + tinted bg.
- Sections grouped with small uppercase labels.

**Venue Switcher**
- Pill in top bar: location icon + venue name + chevron. Triggers a dropdown of venues.
- Critical for multi-location apps. Always visible in the top bar.

### 11.5 Modal & Sheet

**Modal (Desktop)**
- Centered. Max-width 480–560px. Radius 28px. Padding 32px.
- Title (24px bold) + body + actions row (right-aligned, primary + secondary).
- Backdrop: `--surface-overlay`.

**Bottom Sheet (Mobile)**
- Slides up from bottom. Top corners 28px radius. Handle bar 36×4px at top.
- Drag-to-dismiss enabled. Max-height 85vh.

**Popover / Dropdown Menu**
- Anchored to trigger. Radius 16px. Shadow md. Padding 8px.
- Items: 40px tall, 12px horizontal padding, hover bg.

### 11.6 Toasts & Notifications

**Toast (Inline)**
- 4px radius 16. Padding 16 20. Shadow md.
- Variants: success, warning, danger, info. Each has leading icon + optional close.
- Position: top-center on desktop, top of screen on mobile (below status bar).

**Alert Banner (Full-width)**
- Used for in-context warnings. Tinted bg (e.g. butter-soft for warning).
- Leading icon + message + optional action button.

### 11.7 Avatars & Identity

**User Avatar**
- Square with **8–12px radius** (slightly rounded square, not full circle).
- 32px (sm), 40px (md), 56px (lg). Image or initials in coral/butter/lavender bg.
- Online dot: 10px green dot, bottom-right.

**Venue Avatar**
- Same dimensions, but always a colored square with a venue initial or icon.

### 11.8 AI Chat / Assistant Card

A signature component: the **AI Operations Lead** card.
- Header: small avatar + "AI OPERATIONS LEAD" eyebrow.
- Greeting line: "Hi, Hanna!" in 16px medium.
- Insight body: 14–15px secondary text with **highlighted phrases** in coral (the AI's key findings).
- Quick-action chips: pill buttons ("Show labor cost", "Initiate strategy planning").
- Input: "Ask something or choose to start" — full-width text input with voice-icon and plus FAB.

### 11.9 Empty State

- Centered illustration (180–240px square).
- One-line headline (18px semibold).
- One-line description (14px secondary).
- Primary CTA.
- Aspirational tone, never apologetic.

### 11.10 Loading State

- **Skeleton** with subtle shimmer (use `--surface-card-muted` base + light pulse).
- Match the final layout dimensions exactly (no layout shift when loaded).
- For known-duration loads: show **honest progress** ("Compiling a checklist based on…" with a percentage or step indicator).

---

## 12. Mobile Patterns (Phone-First)

### 12.1 Status & Hierarchy
- Status bar transparent or matches top bar color.
- Top bar is **sticky** with a venue switcher pill.
- One **hero card** at the top of every list/feed/dashboard.
- Tap targets ≥ 44×44px (Apple HIG). Primary CTAs ≥ 52px height.

### 12.2 Cards & Lists
- Cards are full-width with `--space-4` gutter on each side.
- Cards stack vertically with `--space-3` or `--space-4` between.
- A list view shows **at most 7 items** before "Show more" — Miller's Law.
- "Continue" / "Pick up where you left off" sits at the top, above any other list.

### 12.3 Floating Action Button (FAB)
- 56×56px, **28px radius** (slightly squared, not full circle).
- Bottom-right, 16px from edge, above the tab bar.
- Coral background. White icon. Casts `--shadow-md`.
- Press: scales to 0.95, shadow lifts.
- One FAB per screen, only for the **primary creative action** ("Add new", "Compose", "Scan").

### 12.4 Bottom Tab Bar
- 5 tabs: home (filled icon when active), insights, search/ask, notifications, profile.
- Active tab: filled icon + label in accent color. Inactive: outline icon + secondary label.
- Subtle top hairline. Background: card.
- FAB can sit above the tab bar, slightly overlapping (16px above) for visual anchoring.

### 12.5 Pull-to-Refresh
- Coral spinner appears below the top bar. Content slides down 60px during refresh.
- Always succeeds with a calm "Updated just now" timestamp.

### 12.6 Gestures
- Swipe back (edge swipe) for navigation.
- Long-press on cards reveals contextual menu (Share, Edit, Delete).
- Pinch-to-zoom on charts (where appropriate).
- Swipe-to-dismiss on bottom sheets.

### 12.7 Mobile-Specific Components
- **Search bar with voice input** — voice icon on the right is always present.
- **Sticky bottom CTA bar** — when the primary action is on a long page (e.g. checkout, review), pin a 64px bar with the action.
- **Date / Time pickers** — use native pickers on iOS/Android; never build custom ones.
- **Haptic feedback** — light tap on primary CTA, success haptic on completed actions.

---

## 13. Desktop / Web Dashboard Patterns

### 13.1 Information Hierarchy
A great dashboard has **exactly one dominant card** per row. Patterns:
- **Hero row:** 1 large coral card (Revenue) + 1 large dark/info card (AI Lead) = visual balance.
- **Secondary row:** 3 stat cards, each with a single KPI.
- **Wide row:** 1 chart spanning the full width.
- **Table row:** 1 list/table spanning full width with inline actions.

### 13.2 Sidebar
- Collapsed (72px, icons only) by default; expands to 240px on hover or pin.
- Section labels (uppercase, 11px, letter-spacing wide) group the icons.
- Active item: coral left-bar (3px) + subtle coral bg tint + accent text color.
- Bottom of sidebar: user avatar + collapse toggle.

### 13.3 Top Bar
- 64px tall. Background: card or canvas.
- Left: brand mark + breadcrumb ("Dashboard / Overview").
- Center: global search (Cmd+K) — appears as a 480px pill that expands on focus.
- Right: venue switcher pill + refresh icon + notifications bell + user avatar.

### 13.4 Dashboard Cards (Detailed)

**Revenue Hero Card (Coral)**
- Full coral bg. Top eyebrow: "REVENUE" 12px white uppercase. Right-side dropdown ("this week").
- Two big stats stacked: "GROSS REVENUE $156,900.67" + delta chip "+7.5%" (pill, white text on semi-transparent white bg).
- "AVG. ORDER VALUE $18.50" + delta chip "+2.4%" + "Growth vs. last week."
- Embedded bar chart at bottom: 7 bars (Mon–Sun), current day (Tue) is full-color, others are dashed/lighter, hover shows tooltip.
- All numbers tabular figures. White text on coral.

**AI Operations Lead Card (Dark)**
- Background: `--surface-inverse` (#0E0F12) — the "card inverts to draw the eye" trick.
- Top: AI avatar + "AI OPERATIONS LEAD" eyebrow.
- Greeting: "Hi, Hanna!" white text.
- Insight: white secondary text with **coral-colored phrases** ("strong revenue", "AOV is dipping", "Labor Cost is 28%") as inline highlights.
- Two chip buttons: "Show labor cost" (coral outline on dark) + "Initiate strategy planning" (white outline on dark).
- Bottom: voice-input bar with coral plus FAB.

**Venue Capacity Card (Lavender)**
- Full lavender bg. Title: "VENUE CAPACITY" white. Dropdown: "this week".
- Day-of-week pills: Mon/Tue/Wed/Thu/Fri/Sat/Sun, each with a percentage (78%, 82%, 91%…).
- Today (Wed) is shown with a darker bg + white text.
- Embedded area chart: coral area on lavender bg.
- Legend at bottom: 3 venues with colored dots.

**Points Card (Map)**
- Map background (muted). Top-right: small filter chips ("all points", "profitability rate", "+1.1%" delta).
- Map pins in coral. Tooltip on pin hover ("The Daily Grind, Astoria, NY").
- Card has a slight shadow since map provides visual depth.

**Operational Timing Card**
- Sage/butter-soft bg. Title: "OPERATIONAL TIMING" ink.
- Center: large circular clock visualization (radial dial) with peak hours shaded.
- Bottom row: legend ("Peak" / "Completion") with colored dots, plus UTC offset and clock time.

### 13.5 Tables
- Row height: 56–64px. Padding 16px.
- Header: 12px uppercase, secondary text, letter-spacing wide.
- Rows separated by 1px subtle border OR 12px of whitespace.
- Hover: subtle bg tint.
- Selected row: left-bar accent + bg tint.
- Inline actions appear on hover (icon buttons on right).

### 13.6 Empty / First-Run Dashboard
- Show a **sample-loaded dashboard** with realistic data, not a blank state.
- A coachmark (3 steps, non-blocking) introduces key actions, then disappears forever.

---

## 14. Data Visualization Style

### 14.1 Chart principles
- **One insight per chart.** Don't combine revenue trend + capacity + labor in one chart.
- **Direct labeling > legends.** Label lines/bars inline. Legends only when 3+ series.
- **Light gridlines** (`rgba(14,15,18,0.06)`) or none at all. No heavy grid.
- **Generous whitespace** inside chart frames.
- **Tabular axis labels.** Numbers, not abbreviations, where space allows.

### 14.2 Color in charts
- **Single series:** use the dominant brand accent (coral for revenue, lavender for capacity, mint for success).
- **Multi-series:** use 2–3 semantic colors. Avoid rainbow palettes.
- **Comparison context (vs last week):** use a faded/dashed version of the accent.
- **Negative deltas:** use `--state-danger`. Positive deltas: `--state-success` or `--accent-mint`.

### 14.3 Chart types in this system

| Chart | When to use | Style notes |
|---|---|---|
| **Bar (vertical)** | Daily/weekly revenue, count over time | Rounded top corners (4–6px). Active bar in full accent, others in 40% opacity. |
| **Area** | Trends over time (capacity, sessions) | Gradient fill from accent (60% opacity) to transparent. Smooth curve (monotone interpolation). |
| **Line** | Multi-series comparison | 2px stroke. Smooth curve. Dots only at data points, 6px diameter. |
| **Donut/Ring** | Composition (% breakdown) | 12–16px stroke. Center label is the total. Active slice in accent, others in 20% opacity. |
| **Radial / Clock** | Operational timing, schedule peaks | 12-hour clock face, colored arcs for peak periods, hands for current time. |
| **KPI tile** | Single number with delta | Hero number 36–48px, label uppercase 12px, delta chip with arrow. |
| **Heatmap** | Patterns across day × week | Soft accent gradient. Avoid red/green-only (colorblind). |
| **Map** | Geographic data | Muted base map (Carto Positron or similar). Single accent pin color. |

### 14.4 Delta chips (universal)
A pill-shaped indicator: `↑ 7.5%` (green/mint for positive) or `↓ 2.4%` (red for negative).
- Height: 22px. Radius: full. Padding: 0 8px. Font: 12px semibold.
- Background: tinted (mint-soft for positive, danger-soft for negative).
- Text color: tinted-text version (mint-text, danger-text).
- Always preceded by an arrow icon (↑ ↓ →).

---

## 15. Illustration Style

### 15.1 Personality
**Quirky, friendly, slightly editorial.** The illustrations in M-Chef look hand-drawn: blocky characters with exaggerated features, bold linework, fills of brand colors (coral, butter, lavender). They never feel corporate; they feel like a New Yorker cartoon with a tablet in hand.

### 15.2 Style rules
- **Linework:** 2–3px black or ink outline. Confident, intentional strokes. Hand-drawn imperfection is welcome.
- **Fills:** flat brand colors. No gradients inside illustrations.
- **Color palette:** coral, butter, lavender, mint, ink — never more than 3 fills per illustration.
- **Composition:** characters/objects are slightly chunky, almost cartoon-y. Faces have minimal detail (dots for eyes, simple shapes).
- **Background:** transparent or single soft tint.
- **Mood:** in-motion, in-conversation, slightly amused. Never static or stock-photo.

### 15.3 Use cases
- Empty states
- Onboarding illustrations
- 404 / error pages
- Marketing hero
- Section dividers in long-form pages
- Achievement / reward illustrations

### 15.4 Don'ts
- No 3D. No realistic humans. No AI-generated photo-style.
- No childish / "nursery" style — these illustrations should feel like an adult drew them.
- No full-bleed background illustrations on functional screens (only on marketing/empty).

---

## 16. Marketing / Landing Page Patterns

### 16.1 Hero section
- **Layout:** Split or asymmetric. Left: large headline + sub + CTA. Right: device mockup or illustration.
- **Headline:** 80–120px, ultra-bold (900 weight), uppercase. Tight letter-spacing. Color: ink or coral.
- **Subhead:** 18–20px regular, secondary text. 1–2 lines max.
- **CTA pair:** primary coral + ghost secondary. Always visible above the fold.
- **Background:** light canvas or soft pastel block (lavender/butter).

### 16.2 Headline patterns
The brand uses **imperative, action-oriented headlines**:
- "STOP ANALYZING AND START ACTING."
- "M-CHEF ADAPTS ITS REPORTING..."
- "NO MORE DAILY REPORTS — JUST SMART RECOMMENDATIONS."

Follow this format: **CAPS, 2–8 words, imperative or declarative.** Always pair with a 1-sentence subhead that explains the value.

### 16.3 Section patterns
1. **Statement section** — huge headline, one sentence, no other elements.
2. **Feature grid** — 2×2 or 3×1 grid, each cell has icon + headline + 1-line description.
3. **Showcase gallery** — large device mockups on a colored background, rotated slightly for energy.
4. **Comparison** — two columns: "Without M-Chef" (muted, gray) vs "With M-Chef" (coral, vivid).
5. **Final CTA** — full-bleed colored band, single sentence, one button.

### 16.4 Device mockups
- **Phone mockups:** realistic but slightly stylized, 2x scale, dark frame, dynamic-island detail.
- **Dashboard mockups:** cropped, slightly tilted (-3° rotation), floating with `--shadow-lg`.
- **Arrangement:** allow overlap, vary sizes (1 big + 2 small), and use brand background colors to separate them.
- **No real screenshots** of the product — use stylized representations with placeholder content (lorem-ipsum-style realistic).

### 16.5 Navigation (Marketing)
- Top bar: brand mark left. Nav links right. CTA button at far right.
- Footer: 4-column grid with product / company / resources / legal links + brand mark.

---

## 17. Empty, Loading, Error & Success States

### 17.1 Empty state
- Illustration (180–240px) + headline + 1-line description + primary CTA.
- Tone: aspirational, not apologetic.
- Example: "Add your first book, article, or PDF." + drop-target.

### 17.2 Loading state
- **Skeleton** matching final layout. Subtle shimmer (1.2s loop).
- **For >2s operations:** show honest progress with named stages:
  - "Reading document…" → "Writing summary…" → "Casting voices…" → "Producing audio…" with a percentage.
- **Spinner only** for indeterminate sub-second operations; otherwise skeleton or staged progress.

### 17.3 Error state
- Always: icon (danger color) + headline + human description + recovery action.
- Never: technical error codes. Translate `Error 503` → "Couldn't reach the data service."
- One clear recovery action: "Retry" / "Go back" / "Contact support."

### 17.4 Success state
- Brief confirmation: green check icon + 1-line message.
- For completed actions: a quick celebratory micro-animation (subtle, ≤500ms) like a confetti pop or a checkmark draw-in.
- Never make success feel louder than necessary.

### 17.5 Zero-data dashboards
- Pre-populate with **sample data** marked clearly as such ("Sample data — connect your account to see real numbers").
- This is the "endowed progress" pattern: don't make the user start from zero.

---

## 18. Voice, Tone & Microcopy

### 18.1 Voice summary
- **Confident** — we know what we're doing.
- **Warm** — we like you.
- **Direct** — no filler.
- **Specific** — concrete numbers and times, not "soon" or "some."

### 18.2 Microcopy patterns

**Buttons**
- Action verbs, present tense: "Show labor cost", "Initiate strategy planning", "Approve critical alerts", "Add new".
- Avoid: "Click here", "Submit", "OK".

**Empty / placeholder**
- "Add your first book, article, or PDF."
- "No reports yet — they'll appear here as they're generated."

**Status messages**
- Success: "Connected to Xero." / "Report sent to your inbox."
- Warning: "Approaching your storage limit."
- Danger: "Couldn't reach the data service — Retry."

**AI insights**
- Conversational: "The Daily Grind shows strong revenue, but two flags need attention: AOV is dipping and Labor Cost is 28%. Let's initiate the optimization strategy."
- Always cite the source or the metric.
- Always end with a recommended action or question.

**Greetings**
- First-person, by name: "Hi, Hanna!"
- Avoid corporate: "Welcome, valued user."

### 18.3 Banned words & phrases
- "Click here", "Submit"
- "Solution", "Leverage", "Synergy", "Best-in-class"
- "Unlock", "Supercharge", "Revolutionize"
- "Just", "Simply", "Easily" (often condescending)
- Excessive punctuation: "!!!", "???"
- ALL CAPS FOR EMPHASIS in body copy (use weight or color)

---

## 19. Accessibility Requirements

### 19.1 WCAG compliance
- **Minimum:** WCAG 2.2 AA across all surfaces. AAA on hero text and reading surfaces.
- **Contrast:** body text ≥ 4.5:1; large text (18px+ or 14px bold+) ≥ 3:1; UI components ≥ 3:1.

### 19.2 Focus & keyboard
- **Focus ring:** 3px coral with 35% alpha halo. Never `outline: none` without replacement.
- **Tab order:** matches visual reading order.
- **Skip links:** "Skip to main content" at the top of every page.
- **Keyboard shortcuts** (web): `Cmd+K` global search, `?` shortcut sheet, `G` then `H` for home, etc.

### 19.3 Screen readers
- All icons have `aria-label`.
- Status changes announce via `aria-live="polite"`.
- Charts have a text-table alternative (sr-only).
- AI insights are announced in full when generated.

### 19.4 Motion
- Respect `prefers-reduced-motion`: disable non-essential motion. Keep color/opacity transitions only.
- No flashing > 3Hz.
- Auto-playing animations (shimmer, pulse) allowed; auto-playing video/audio never.

### 19.5 Touch & targets
- Touch targets ≥ 44×44px (Apple HIG).
- Spacing between adjacent targets ≥ 8px.
- Drag/swipe actions always have a tap alternative.

### 19.6 Color independence
- Never use color alone: pair every state with an icon, label, or pattern.
- Color-blind users: test with deuteranopia/protanopia simulators. Avoid red/green-only signaling.

### 19.7 Text
- Respect OS font scaling.
- Body text minimum 15px (web), 17px (mobile reading surface).
- All text remains legible at 200% browser zoom without horizontal scroll.

---

## 20. Responsive & Adaptive Rules

### 20.1 Breakpoints

```
--bp-sm:   640px    /* small tablet, large phone landscape */
--bp-md:   768px    /* tablet portrait */
--bp-lg:   1024px   /* tablet landscape, small laptop */
--bp-xl:   1280px   /* desktop */
--bp-2xl:  1536px   /* large desktop */
```

### 20.2 Behavior per breakpoint

**Phone (<640px)**
- Single column. Full-width cards. Sticky bottom tab bar. Sticky top bar.
- FAB present. Bottom sheets for modals.

**Tablet (640–1024px)**
- 2-column card grids. Sidebar collapses to icon-only. Modals still center.
- Some screens (dashboard) remain single column for clarity.

**Desktop (≥1024px)**
- Full sidebar. 3–4 column card grids. Wide charts. Multi-column forms.
- Hover states active. Right rail available for AI/notification context.

**Large desktop (≥1280px)**
- Content max-width 1440px, centered.
- Right rail always visible on dashboard.

### 20.3 Card grid behavior

| Breakpoint | Cards per row |
|---|---|
| <640 | 1 |
| 640–1024 | 2 |
| 1024–1280 | 3 |
| ≥1280 | 4 |

### 20.4 Typography scaling
- Body text scales up by 1px at desktop (16px → 17px) for legibility on larger screens.
- Hero/KPI numbers scale up dramatically: 36px on mobile → 48px on desktop.

### 20.5 Mobile-first
- Author CSS mobile-first.
- Use `clamp()` for fluid type and spacing where possible.
- Container queries for component-level responsiveness (cards behave differently inside a sidebar vs main column).

---

## 21. Adapting the System to Other Apps

The M-Chef design system is built to be **re-skinnable**. To adapt it for a different product:

### 21.1 Decision: keep vs change

| Element | Keep (identity) | Change (domain) |
|---|---|---|
| Type family (Inter) | ✓ | |
| Spacing scale | ✓ | |
| Radius scale | ✓ | |
| Component anatomy | ✓ | |
| Layout patterns | ✓ | |
| Elevation model | ✓ | |
| Brand colors | | ✓ (see 21.2) |
| Accent associations | | ✓ (see 21.3) |
| Hero copy voice | | ✓ (match product domain) |
| Illustration style | ✓ (mostly) | Adjust subject matter |
| Icon library | ✓ | |

### 21.2 Picking your brand colors
The system has **6 named brand slots**:
1. **Primary** (replaces Coral) — used for the dominant CTA, revenue/hero metric. Pick your boldest brand color.
2. **Secondary warm** (replaces Butter) — for "in progress," soft warnings.
3. **Secondary cool** (replaces Lavender) — for informational, neutral-positive.
4. **Success** (replaces Mint) — for healthy/completed states.
5. **Ink** — always near-black for text and dark sections.
6. **Pastel canvas** (replaces cream) — warm off-white for app background.

**Rules:**
- Pick one **bold** primary. Two **muted** secondaries. One **cool** info color.
- Maintain a **bg-soft variant** for each accent (15% tint) for chips and tinted sections.
- Maintain a **text variant** for each accent (60% darker) for text on soft bgs.

**Examples of valid adaptations:**
- Fintech: primary = deep blue, secondary = teal, cool = lavender (replace coral+butter+lavender).
- Health: primary = coral, secondary = mint (already), warm = peach.
- EdTech: primary = indigo, secondary = amber, cool = sky.
- Marketplace: primary = coral (keep), secondary = butter (keep), cool = lavender (keep).

### 21.3 Re-mapping accent associations
Each accent carries a **meaning**. When you swap brand colors, re-document what each means in your product:

| Accent | Original meaning | Re-map for your app |
|---|---|---|
| Primary | Revenue / main KPI / Act now | Whatever your product's "hero metric" is |
| Warm secondary | In progress / Pre-arrival | Pending / Draft |
| Cool secondary | Capacity / info | Capacity / Activity |
| Success | Healthy / Connected | Healthy / Connected |
| Danger | Disconnected / Over limit | Disconnected / Over limit |
| Ink | Neutral action | Neutral action |

### 21.4 Re-mapping hero components
The 3 hero card archetypes from M-Chef transfer cleanly to most data products:
- **Revenue card** (primary accent, big number + chart)
- **AI Lead card** (dark, conversational, quick actions)
- **Capacity card** (cool accent, week-strip + chart)

Translate to your domain:
- **E-commerce:** Revenue → Sales Today. AI Lead → Recommended Actions. Capacity → Inventory.
- **SaaS:** Revenue → MRR. AI Lead → Customer Health Summary. Capacity → Active Users.
- **Health:** Revenue → Calories Burned. AI Lead → Daily Insight. Capacity → Hydration.

### 21.5 What stays constant
- The hero card always has a **top-eyebrow + big-number + small-chart** composition.
- The AI/insight card always uses the **dark surface** with **inline coral highlights** (swap coral to your primary).
- The chart always sits at the **bottom of the card**, sized to fill width with internal padding.
- The bottom tab bar pattern, sidebar pattern, venue/context switcher all transfer.

---

## 22. Quick-Start Recipe for a New App

### 22.1 Day 1: foundations
1. Set up **tokens** (colors, type, spacing, radius, motion) per section 3–10.
2. Install Inter. Set up tabular figures globally on `<body>`.
3. Build a **theme provider** with light + dark variants.
4. Build core primitives: **Button, Input, Card, Chip, Avatar, Tabs, Toast**.
5. Set up a **Storybook** (or equivalent) for every primitive.

### 22.2 Day 2–3: layouts & navigation
1. Build **Top Bar**, **Bottom Tab Bar**, **Sidebar**.
2. Build **Venue/Context Switcher**.
3. Build **Dashboard layout shell** with the 3-card hero row.
4. Build **Mobile layout shell** with sticky top, hero card, stack.

### 22.3 Day 4–5: data components
1. Build **KPI tile, Hero KPI card, Delta chip**.
2. Build **Bar, Area, Line, Donut** charts with the system's chart style.
3. Build **Table** primitive with hover/select states.
4. Build **AI Insight card** (dark variant).

### 22.4 Day 6: feature screens
1. Build **List/feed screens** with ≤7-item chunks + "Show more."
2. Build **Detail screens** with hero + sections.
3. Build **Settings** with grouped rows + switches.
4. Build **Empty/loading/error states** for each.

### 22.5 Day 7: marketing
1. Build **Marketing hero** (split layout + device mockup).
2. Build **Feature grid, Showcase, Comparison, Final CTA** sections.
3. Source/create **3–5 illustrations** in the established style.

### 22.6 Acceptance checklist
- [ ] All colors come from tokens; no hard-coded hex anywhere.
- [ ] All spacing is from the 4px scale.
- [ ] All text uses Inter; tabular figures on all data.
- [ ] All buttons follow the variant rules; primary CTA uses brand color.
- [ ] All cards use 20px radius.
- [ ] All shadows come from tokens.
- [ ] All motion uses the timing/easing tokens.
- [ ] Focus rings visible on every interactive element.
- [ ] Tap targets ≥ 44×44.
- [ ] All AI/insight cards use the dark-surface + inline-highlight pattern.
- [ ] Charts use the system's color/style rules.
- [ ] Empty states have illustration + headline + CTA.
- [ ] Loading states use skeleton or honest staged progress.
- [ ] Error messages are human and actionable.

---

## 23. Anti-Patterns (What NOT to do)

### Visual
- ❌ **Pure white or pure black backgrounds.** Use warm off-white / true dark.
- ❌ **3+ bright colors per screen.** Pick one hero accent, support with neutrals.
- ❌ **Mixed corner radii in one component** (top 8px, bottom 24px).
- ❌ **Drop shadows on every card.** Reserve shadows for floating elements.
- ❌ **Gradient buttons.** Use solid accent fills.
- ❌ **Glassmorphism / backdrop blur.** The system commits to solid surfaces.
- ❌ **Decorative gradients in hero text.** Use solid color, weight, and size.
- ❌ **Stock photos of people.** Use illustrations or genuine product screenshots.

### Typographic
- ❌ **More than 2 type families.** Inter covers everything.
- ❌ **Centered body text.** Left-align, ragged right.
- ❌ **Justified text.** Creates rivers.
- ❌ **All-lowercase headlines for branding.** Pick a case (UPPER, Title, or sentence) and stick to it.
- ❌ **Tiny grey text below 12px** for anything important.
- ❌ **Line height below 1.2 for body.** Crowds the eye.

### Layout
- ❌ **Infinite scroll on lists.** Use pagination or "Show more" (Miller's Law).
- ❌ **Mid-flow popups.** Save prompts/upsells wait for natural pauses.
- ❌ **Auto-playing carousels.** The user must control motion.
- ❌ **Sidebar navigation on mobile.** Use bottom tabs.
- ❌ **Hidden navigation** (hamburger only). Show labels.
- ❌ **Multiple primary CTAs on one screen.** One hero action per screen.

### Interaction
- ❌ **Confirm modals for non-destructive actions.** Use undo or just do it.
- ❌ **Spinner-of-doom for >2s operations.** Show honest progress with stages.
- ❌ **Toast spam.** Group notifications, summarize.
- ❌ **Haptic feedback on every tap.** Use it sparingly for confirmations only.
- ❌ **Sound effects on UI actions.** Default off; never autoplay.

### Data
- ❌ **Pie charts with 6+ slices.** Use a bar chart.
- ❌ **3D charts.** Always flat.
- ❌ **Y-axes that don't start at zero on bar charts.** Deceptive.
- ❌ **Red/green only for comparison.** Pair with icons + labels.
- ❌ **Tons of decimal precision.** Round sensibly: `$21,150.88` ok, `$21,150.8839485` not.
- ❌ **Percentages without context.** "+7.5%" alone is meaningless; "+7.5% vs last week" is informative.

### AI / LLM
- ❌ **AI-generated answers without citations.** Always link to source.
- ❌ **AI copy that sounds like AI** ("As an AI, I..."). Speak in product voice.
- ❌ **Fake progress estimates** ("Almost done!" when it takes 90s). Be honest.
- ❌ **Silent AI rewrites.** Show diffs so users trust the output.

### Brand
- ❌ **Saying "AI-powered" repeatedly.** It's assumed; show, don't tell.
- ❌ **Hype words**: unlock, supercharge, revolutionize, leverage, synergy.
- ❌ **Testimonials as primary proof.** Show product capability.
- ❌ **Generic hero illustrations of people pointing at screens.** Use specific product mockups.

---

## 24. Token Reference (Copy-Paste Ready)

### 24.1 CSS custom properties (full set)

```css
:root {
  /* === Spacing === */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --space-10: 64px;
  --space-11: 80px;
  --space-12: 96px;

  /* === Radius === */
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius-2xl: 36px;
  --radius-full: 9999px;

  /* === Type === */
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 15px;
  --font-size-md: 17px;
  --font-size-lg: 20px;
  --font-size-xl: 28px;
  --font-size-2xl: 36px;
  --font-size-3xl: 48px;
  --font-size-display: 80px;
  --font-size-mega: 120px;

  --line-height-tight: 1.05;
  --line-height-snug: 1.2;
  --line-height-normal: 1.4;
  --line-height-relaxed: 1.5;
  --line-height-loose: 1.65;

  --tracking-tightest: -0.04em;
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.04em;
  --tracking-widest: 0.12em;

  /* === Motion === */
  --duration-instant: 80ms;
  --duration-fast: 150ms;
  --duration-base: 220ms;
  --duration-slow: 320ms;
  --duration-deliberate: 480ms;

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in: cubic-bezier(0.6, 0, 0.8, 0.2);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* === Borders === */
  --border-subtle: 1px solid rgba(14, 15, 18, 0.06);
  --border-default: 1px solid rgba(14, 15, 18, 0.10);
  --border-strong: 1px solid rgba(14, 15, 18, 0.18);
}

/* Light theme (default) */
:root, [data-theme="light"] {
  --surface-canvas: #ECEFE6;
  --surface-card: #FFFFFF;
  --surface-card-muted: #F4F1EA;
  --surface-elevated: #FFFFFF;
  --surface-inverse: #0E0F12;
  --surface-overlay: rgba(14, 15, 18, 0.55);

  --text-primary: #0E0F12;
  --text-secondary: #5C6068;
  --text-tertiary: #8E929B;
  --text-inverse: #F4F1EA;
  --text-inverse-muted: #B5B8BF;

  --accent-coral-bg: #FF5C44;
  --accent-coral-bg-soft: #FFE3DC;
  --accent-coral-fg: #FFFFFF;
  --accent-coral-text: #C8341B;

  --accent-butter-bg: #F5C84C;
  --accent-butter-bg-soft: #FFEFC5;
  --accent-butter-fg: #0E0F12;
  --accent-butter-text: #6B4F00;

  --accent-lavender-bg: #B5A6FF;
  --accent-lavender-bg-soft: #E4DDFF;
  --accent-lavender-fg: #FFFFFF;
  --accent-lavender-text: #4433B5;

  --accent-mint-bg: #7FE3B0;
  --accent-mint-bg-soft: #D6F5E5;
  --accent-mint-fg: #0E0F12;
  --accent-mint-text: #1B6B45;

  --accent-ink-bg: #0E0F12;
  --accent-ink-fg: #FFFFFF;

  --state-success: #1F9E5A;
  --state-success-bg: #E5F6EC;
  --state-warning: #C97A0F;
  --state-warning-bg: #FFF1DC;
  --state-danger: #D62E2E;
  --state-danger-bg: #FCE4E4;
  --state-info: #2A5BD7;
  --state-info-bg: #E2EAFB;

  --shadow-xs: 0 1px 2px rgba(14, 15, 18, 0.04);
  --shadow-sm: 0 2px 6px rgba(14, 15, 18, 0.06), 0 1px 2px rgba(14, 15, 18, 0.04);
  --shadow-md: 0 6px 16px rgba(14, 15, 18, 0.08), 0 2px 4px rgba(14, 15, 18, 0.04);
  --shadow-lg: 0 12px 32px rgba(14, 15, 18, 0.12), 0 4px 8px rgba(14, 15, 18, 0.06);
  --shadow-xl: 0 24px 56px rgba(14, 15, 18, 0.18), 0 8px 16px rgba(14, 15, 18, 0.08);
  --shadow-focus: 0 0 0 3px rgba(255, 92, 68, 0.35);
}

/* Dark theme */
[data-theme="dark"] {
  --surface-canvas: #0E0F12;
  --surface-card: #18191C;
  --surface-card-muted: #222428;
  --surface-elevated: #25272B;
  --surface-overlay: rgba(0, 0, 0, 0.65);

  --text-primary: #F4F1EA;
  --text-secondary: #B5B8BF;
  --text-tertiary: #7A7E87;

  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 6px 16px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.55), 0 4px 8px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 24px 56px rgba(0, 0, 0, 0.65), 0 8px 16px rgba(0, 0, 0, 0.45);
  --shadow-focus: 0 0 0 3px rgba(255, 92, 68, 0.45);
}
```

### 24.2 Tailwind config (snippet)

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: 'var(--surface-canvas)',
        card: 'var(--surface-card)',
        'card-muted': 'var(--surface-card-muted)',
        elevated: 'var(--surface-elevated)',
        inverse: 'var(--surface-inverse)',
        ink: { DEFAULT: '#0E0F12', light: '#5C6068', mute: '#8E929B' },
        coral: { bg: '#FF5C44', soft: '#FFE3DC', text: '#C8341B', fg: '#FFFFFF' },
        butter: { bg: '#F5C84C', soft: '#FFEFC5', text: '#6B4F00', fg: '#0E0F12' },
        lavender: { bg: '#B5A6FF', soft: '#E4DDFF', text: '#4433B5', fg: '#FFFFFF' },
        mint: { bg: '#7FE3B0', soft: '#D6F5E5', text: '#1B6B45', fg: '#0E0F12' },
        success: '#1F9E5A',
        warning: '#C97A0F',
        danger: '#D62E2E',
        info: '#2A5BD7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        sm: ['13px', { lineHeight: '1.4' }],
        base: ['15px', { lineHeight: '1.5' }],
        md: ['17px', { lineHeight: '1.5' }],
        lg: ['20px', { lineHeight: '1.3' }],
        xl: ['28px', { lineHeight: '1.2' }],
        '2xl': ['36px', { lineHeight: '1.15' }],
        '3xl': ['48px', { lineHeight: '1.1' }],
        display: ['80px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        mega: ['120px', { lineHeight: '1.0', letterSpacing: '-0.04em' }],
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '16px',
        lg: '20px',
        xl: '28px',
        '2xl': '36px',
        full: '9999px',
      },
      spacing: {
        0: '0', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
        6: '24px', 7: '32px', 8: '40px', 9: '48px', 10: '64px',
        11: '80px', 12: '96px',
      },
      transitionDuration: {
        instant: '80ms', fast: '150ms', base: '220ms',
        slow: '320ms', deliberate: '480ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        in: 'cubic-bezier(0.6, 0, 0.8, 0.2)',
        inout: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(14, 15, 18, 0.04)',
        sm: '0 2px 6px rgba(14, 15, 18, 0.06), 0 1px 2px rgba(14, 15, 18, 0.04)',
        md: '0 6px 16px rgba(14, 15, 18, 0.08), 0 2px 4px rgba(14, 15, 18, 0.04)',
        lg: '0 12px 32px rgba(14, 15, 18, 0.12), 0 4px 8px rgba(14, 15, 18, 0.06)',
        xl: '0 24px 56px rgba(14, 15, 18, 0.18), 0 8px 16px rgba(14, 15, 18, 0.08)',
        focus: '0 0 0 3px rgba(255, 92, 68, 0.35)',
      },
    },
  },
};
```

### 24.3 Global CSS baseline

```css
/* Apply once at app root */
*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--surface-canvas);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Tabular figures globally for any data */
.tabular { font-variant-numeric: tabular-nums; }

/* Focus ring */
:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-radius: var(--radius-sm);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 80ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Appendix A: Screen-by-Screen Breakdown of Reference Imagery

For audit traceability, here is how each component in the reference boards maps to this system:

| Component in reference | System location |
|---|---|
| Operational Timing card (clock) | §11.3 Hero Card + §14.3 Radial/Clock chart |
| Workers screen (coral bg, characters) | §15 Illustration + §11.6 Mobile layout |
| Points screen (map + chip filters) | §14.3 Map chart + §11.2 Chips |
| Revenue card (coral hero, 7 bars) | §11.3 Hero Card + §14.3 Bar chart + §11.8 Stat pattern |
| Venue Capacity card (lavender, week strip + area) | §11.3 Hero Card + §14.3 Area chart |
| AI Operations Lead card (dark, chips, input) | §11.8 AI Insight Card |
| Stabilizing Labor Cost card (butter bg) | §11.3 Hero Card |
| Category cards (yellow with illustration) | §15 Illustration + §11.3 Hero Card |
| Integrations cards (QuickBooks/Xero/Homebase) | §11.3 Integration Card |
| Prime Cost Report card | §11.3 List Card |
| Top bar (venue switcher, search, refresh, avatar) | §11.4 Top Bar + §11.4 Venue Switcher |
| Sidebar (icon nav, user avatar at bottom) | §11.4 Sidebar |
| Bottom tab bar (4 icons + FAB) | §12.4 Bottom Tab Bar + §12.3 FAB |
| Marketing hero (huge headline, device mockups) | §16.1 Hero Section + §16.4 Device mockups |
| Marketing headline "STOP ANALYZING…" | §16.2 Headline pattern |
| Section eyebrow labels (REVENUE, WORKERS, etc.) | §4.3 Case rules + §4.5 Tracking |
| Delta chips (+7.5%, +2.4%) | §14.4 Delta chips |
| Search field with voice icon | §11.2 Search Field |
| "+" FAB on mobile (square-with-rounded-corners) | §12.3 FAB |

---

## Appendix B: When in Doubt

| Question | Answer |
|---|---|
| Should this be a button or a link? | If it **does** something (action), it's a button. If it **goes somewhere** (navigation), it's a link. |
| What radius should this card be? | 20px. Always start there. Only deviate for hero cards (28px) or nested elements (12–16px). |
| What color is the primary CTA? | The dominant brand accent (coral by default). On dark backgrounds, white. |
| How big should the hero number be? | 36px mobile, 48px desktop, tabular figures. Don't go smaller; don't go larger without reason. |
| Where does this go — top bar, sidebar, or bottom tab? | **Top bar:** always-visible context (venue, user). **Sidebar:** primary navigation destinations. **Bottom tab:** 3–5 top-level mobile destinations. |
| One accent color or many? | One bright accent as the hero. Two muted pastels as supporting. Done. |
| Card on light or dark? | Light cards on light canvas (most common). Dark cards for **AI/insight** sections or to make a single card "the moment." Don't use dark cards for everything. |
| How many items in this list? | ≤7 per chunk. Always. |

---

## 25. Visual Language v2 — Editorial-Minimal Refresh (2026-06-27)

> **Status: canonical.** This section is the current visual law and **supersedes
> earlier rules where they conflict** (noted in §25.12). It evolves the system
> toward a *modern, sleek, editorial-minimal* aesthetic with a *technical/sci-fi*
> edge, derived from reference imagery (gallery/audio editorial apps). The
> foundation is unchanged — warm paper, ink, coral, Inter, generous void — this
> raises the *craft*: type as hero, instrument-grade numerals, strict pill/circle
> controls, hairline structure, bento layout, and disciplined depth.

### 25.0 Ethos — the one paragraph

**The page is a gallery wall.** Oversized type does the work; chrome disappears.
Structure is drawn with hairlines and void, not boxes. There is exactly **one hot
accent** (coral) per screen, used fearlessly — full-bleed when it's the moment,
silent otherwise. Numbers and labels are **instrument-grade**: monospaced, tabular,
tracked — they read like a HUD, not body copy. Every interactive thing is a **pill
or a circle**. Nothing is decorative; nothing is busy. Calm, precise, confident.

Three test questions for any new screen:
1. Is the largest thing on screen the *content title* (not a button, bar, or icon)?
2. Could I remove one more border/box and replace it with space or a hairline?
3. Is there exactly one coral moment — and does it earn it?

---

### 25.1 Color system

Palette is **paper + ink + one hot accent + rare editorial accents**. All accents
ship as **CSS variables** (so themes — including e-ink — can remap them; fixes the
prior limitation where accents were hard-coded and e-ink couldn't drop them).

**Neutrals (the 95% of every screen)**

| Token | Light | Role |
|---|---|---|
| `--canvas` | `#ECEFE6` | App background (warm paper, never `#FFF`) |
| `--surface` | `#FFFFFF` | Cards, sheets, rows |
| `--surface-muted` | `#F4F1EA` | Inset/secondary surface, soft icon-button fill |
| `--ink` | `#0E0F12` | Primary text + ink fills (never `#000`) |
| `--ink-2` | `#5C6068` | Secondary text (meta, subtitles) |
| `--ink-3` | `#646871` | Tertiary text (hints) — **AA-safe**, replaces the old `#8E929B` |
| `--hairline` | `rgba(14,15,18,.08)` | Structural rules + dividers (the workhorse) |
| `--hairline-strong` | `rgba(14,15,18,.16)` | Emphasized dividers, input borders |

**Coral — the primary accent (a real ramp, not one value)**

| Token | Hex | Use | Contrast note |
|---|---|---|---|
| `--coral-050` | `#FFF1ED` | Faintest tint (hover wash) | — |
| `--coral-100` | `#FFE3DC` | Soft fill — **active/selected row bg** | text uses `--coral-700` |
| `--coral-500` | `#FF5C44` | **Hero fill, large** (full-bleed, big play, ≥24px text only) | white text 3.06:1 → large only |
| `--coral-600` | `#D83A22` | **Primary CTA fill** with body-size labels | white 4.62:1 ✓ AA |
| `--coral-700` | `#B82E18` | **Coral text/links** on warm surfaces | 5.2:1 on paper/card ✓ |
| `--coral-900` | `#4A1B0C` | Text on coral-050/100 tints | — |

Rule: **`coral-500` for big/full-bleed fills, `coral-600` for buttons with text,
`coral-700` for text/links.** Never white-on-`coral-500` at body size.

**Secondary editorial accents (the "gallery" colors — use ≤1 per screen, for
*content tiles/illustration only*, never for a primary control)**

| Token | Fill | Soft | Ink-on-fill |
|---|---|---|---|
| `--lime` | `#C7F03F` | `#EAF7B0` | `#34400A` |
| `--butter` | `#F5C84C` | `#FFEFC5` | `#6B4F00` |
| `--lavender` | `#B5A6FF` | `#E4DDFF` | `#4433B5` |
| `--mint` | `#7FE3B0` | `#D6F5E5` | `#1B6B45` |

These are the punchy "Tickets Available" lime / collage yellow moments. They tint a
*tile*, never a button. Text on a colored fill always uses that family's ink stop
(never black/gray).

**The active-state pattern (codified).** A selected/playing list row is
`background: var(--coral-100)` + `color: var(--coral-700)` (title) with the meta in
`--coral-600` — the warm "peach row." This is the canonical selection treatment
across lists, tabs, and filters. Never rely on color alone — pair with weight (700)
or a leading marker.

**Theme mapping.** `light` as above. `dark`: paper→`#0E0F12`, surface→`#18191C`,
ink→`#F4F1EA`, coral ramp stays but text-coral lightens to ~`#FF8A75` (AA on dark).
`sepia`: warm cream set (existing). `eink`: **all accents collapse to grayscale** —
`--coral-600`→`#1A1A1A`, soft→`#E6E6E6`, secondary accents→neutral gray; the only
non-gray element permitted is none. (This is why accents must be vars.)

---

### 25.2 Typography

**Families**

| Role | Family | Notes |
|---|---|---|
| UI + display + reading | **Inter** (variable, `font-optical-sizing: auto`) | Inter Display metrics kick in at large sizes — this is what makes titles feel "drawn," not "set." |
| Numerals, timecodes, counts, micro-labels | **Geist Mono** (fallback `JetBrains Mono`, then `ui-monospace`) | The instrument-grade/technical voice. **New, ratifiable amendment** to the old "Inter only" rule — see §25.12. If you must stay pure-Inter, substitute Inter with `font-variant-numeric: tabular-nums` + `+0.02em` tracking. |

**Scale** (fluid `clamp(min, vw, max)` for display so titles dominate on every width)

| Style | Size | Weight | Tracking | Leading | Where |
|---|---|---|---|---|---|
| Display 0 (hero numeral/title) | `clamp(48px,12vw,80px)` | 800 | `-0.04em` | 0.95 | "47", "Content", clocks |
| Display 1 (page title) | `clamp(34px,8vw,52px)` | 800 | `-0.035em` | 1.0 | "Your library", "Lumina Art" |
| Display 2 (section) | `clamp(26px,6vw,38px)` | 800 | `-0.03em` | 1.05 | "Popular", "Gallery", "Novels" |
| Title | `22–24px` | 700 | `-0.02em` | 1.12 | card/list titles |
| Subtitle | `17–18px` | 600 | `-0.01em` | 1.3 | secondary headings |
| Body / reading | `16–18px` | 400 | 0 | 1.5–1.6 | prose, reading column |
| Label | `13px` | 500 | 0 | 1.4 | controls, meta |
| **Micro-label (eyebrow)** | `11–12px` | 600 | **`+0.08em`** | 1.3 | UPPERCASE markers: "PLACE", "NEXT", "EXHIBITS", "NOW PLAYING" |
| **Mono numeral** | inherit | 500 | `0` | — | mono + `tabular-nums`: "31 tracks", "06:52", "Total 124" |
| **Count superscript** | `0.55em` of parent, raised | 500 | — | mono, coral or ink: "Featured¹²" |

**Signature treatments**
- **Thin giant numeral.** The hero stat/clock ("47", "06") may render at Display-0
  size in **weight 200–300** (or mono) for the editorial thin-vs-bold contrast.
- **Outlined numeral (optional hero).** The stroked "06" look:
  `color: transparent; -webkit-text-stroke: 2px var(--ink);` (coral variant for the
  active digit). Use once per screen, max.
- **Eyebrow + title pair.** Sections lead with a micro-label eyebrow above a
  Display-2 title (e.g. `PLACE` ▸ "Lumina Art").
- **Weight set is fixed:** 400 / 500 / 600 / 700 / 800. No others. Body is never
  >400; titles are never <700.

Reading surface keeps its own restraint (§6): 16–18px / 1.5–1.6 / 66ch / weight 400.
**Drama lives in titles and numerals, never in the reading column.**

---

### 25.3 Shape & elevation

**Radius scale** (interactive = pill or circle; surfaces = soft rounds)

| Token | Value | Use |
|---|---|---|
| `--r-pill` | `9999px` | **All text buttons, chips, tabs, search field** |
| `--r-circle` | `50%` | **All icon-only buttons, avatars** |
| `--r-thumb` | `12px` | List-row thumbnails, small media |
| `--r-card` | `20px` | Standard cards (unchanged default) |
| `--r-tile` | `24px` | Bento tiles, cover tiles |
| `--r-sheet` | `28px` | Bottom sheets, modals, hero cards |
| `--r-squircle` | `22px` | The large hero **play** control (optional rounded-square, per reference) |

**Elevation** (define and *use* — the prior `shadow-soft` was referenced but never
defined). Soft, low, warm-tinted shadows; never harsh.

| Token | Value | Use |
|---|---|---|
| `--elev-0` | none | Flat on canvas |
| `--elev-1` | `0 1px 2px rgba(14,15,18,.05)` | Resting cards/rows |
| `--elev-2` | `0 6px 20px rgba(14,15,18,.08)` | Hover lift, now-playing card |
| `--elev-3` | `0 16px 40px rgba(14,15,18,.12)` | Sheets, menus, dialogs |

**Hairlines do the structural work.** Prefer a `--hairline` rule or pure space over
a bordered box. Full-bleed hairline dividers separate sections (editorial). Borders
on cards are `0.5px solid var(--hairline)`.

**Gradient — one sanctioned pattern only.** A vertical `--surface → --surface-muted`
(white→cream) wash on **now-playing / cover / hero** surfaces. Never on text, never
on controls, never more than one per screen. (Amends the blanket "no gradient" lean.)

---

### 25.4 Iconography

**Adopt Lucide** (`lucide-react`; `lucide-react-native` for mobile/extension →
cross-surface parity). This replaces *all* unicode/emoji/text glyphs.

- **One stroke (`1.75`), two sizes (`20` inline / `24` chrome), `currentColor`.**
- Every icon-only button = circular `IconButton` with `aria-label`.
- Canonical mapping: `Sun/Moon/Coffee/Contrast` (themes) · `SlidersHorizontal`
  (filter) · `Search` · `HelpCircle` · `ArrowUpRight` (the ↗ "open") · `ArrowRight`
  · `Play/Pause` · `Rewind/FastForward` or `RotateCcw/RotateCw` (skip) · `AudioLines`
  (voice/waveform) · `Bookmark` · `Plus` · `Menu` · `X` · `EyeOff` (locked/premium)
  · `Sparkles` (bionic) · `ScanEye` (focus) · `Ruler` (reading guide) · `Keyboard`
  (shortcuts) · `Hexagon`/`Settings2` (settings).

Never hand-draw icon paths; never mix two icon libraries.

---

### 25.5 Buttons — the complete system

**Two shapes only: pill (text) and circle (icon).** One height per size; consistent
focus ring (coral 3px), `active:scale(.97)`, `transition` on the motion tokens.

**`Button` (pill, `--r-pill`)**

| Variant | Rest | Text | Use |
|---|---|---|---|
| `primary` | `--coral-600` | white | the **one** hero CTA per screen |
| `inverse` | `--ink` | `--surface` | contextual primary on busy/coral/photo ("Pause", "Menu", "Play") |
| `secondary` | `--surface` + `0.5px --hairline` | `--ink` | secondary actions ("Top 10", "Scan an image") |
| `ghost` | transparent | `--ink` | tertiary/inline; hover = `--coral-050` |

Sizes: `sm 36px` / `md 44px` / `lg 52px` height; horizontal padding `16/20/24`; label
`13/15/16px` weight 500. Hover = base accent darkened ~6% (derive, **never** a
hardcoded hex — removes the old `#E54E37`/`#B82626`). Disabled = 38% opacity, no
shadow. Loading = leading 16px spinner + label stays (never a bare spinner).

**`IconButton` (circle, `--r-circle`)** — sizes `36 / 44 / 56`; icon `20 / 20 / 24`.

| Variant | Fill | Use |
|---|---|---|
| `surface` | `--surface-muted` | default tool (the reference's gray filter button) |
| `ghost` | transparent → hover `--coral-050` | quiet tools |
| `inverse` | `--ink` | on coral/photo |
| `coral` | `--coral-600` | a featured icon action |

**Hero play control.** Large `64–72px` — either a **coral circle** (`--coral-600`,
white `Play/Pause`) or a **coral squircle** (`--r-squircle`, per the reference). One
per player. Skips = `44px` `ghost`/`surface` circles. **Never a rounded-rectangle.**

This kills the current inconsistency: today buttons span `rounded-md` squares + pills
+ bespoke coral fills at `h-10/12/14/16`. v2 = pill + circle, three heights, four
variants. Nothing else.

---

### 25.6 Cards, tiles & lists

**Editorial list row** (reference set 2: "Timeless Threads · 31 tracks")
- `thumb` (`--r-thumb`, 56px, cover/gradient) · title (Title, 700) · meta right
  (mono, `--ink-2`: "31 tracks") · full-row hairline-bottom, no box.
- **Active/playing row:** `--coral-100` bg, `--coral-700` title, `--coral-600` meta
  (the peach row). 64px row height, 12px gap, 20–24px side padding.

**Bento tile** (reference set 1: the "Content" mosaic)
- `--r-tile`, cover or gradient or solid; **Display-2 title (800)**, `ArrowUpRight`
  top-right as the "open" affordance, optional source pill bottom-left.
- Variants: **featured** (spans 2 cols, big cover + progress), **standard**, **coral
  feature** (`--coral-500` fill, white title — one per grid), **image tile** (full-
  bleed cover), **stat tile** (§25.7).
- Mosaic rhythm: alternate tall/short, never a uniform grid; gaps `12–16px`.

**Now-playing card** (reference: "Episode 6" / "Patrick Goodwin")
- `--r-sheet`, `--surface → --surface-muted` gradient, `--elev-2`. Avatar + name +
  role (mono micro-label), `ArrowUpRight` circle top-right, Title (700), **equalizer**
  (§25.8) right, `inverse` pill ("Pause") bottom-left, `Bookmark` circle bottom-right.

**Stat / metric tile** (reference: "47 new materials", "564 Exhibits", "Total 124")
- Micro-label (mono, uppercase) + **giant numeral** (Display-0, thin or mono) +
  optional delta chip. `--surface-muted` or coral fill; `--r-tile`; no border.

**Cover art (fixes "text-only / incomplete").** Documents have no covers — **generate
a deterministic cover per `docId`**: a 2–3 stop gradient mesh keyed by a hash of the
id, biased to coral/ink, with an optional grain/contour overlay; fetch OG images for
URL imports. This single change removes the "spreadsheet" feel from the library.

Cards rest at `--elev-1`, lift to `--elev-2` on hover with a `transform: translateY(-2px)`
(motion tokens). Radius is `--r-card`/`--r-tile`; modals `--r-sheet`. Never `rounded-xl`
one-offs (the prior CommandPalette/KeyboardShortcuts drift to 28px → normalize).

---

### 25.7 Layout & grid

- **Base unit 4px.** Phone side margin `20–24px`; gutters `12–16px`. Mental grid:
  4-col phone, 8-col tablet, 12-col desktop.
- **Page header pattern:** big Display-1 title flush-left, a single circular
  `IconButton` (filter/settings) flush-right, optional avatar+role left. Generous top
  margin (`28–40px`) before the title — let it breathe.
- **Section rhythm:** `eyebrow micro-label` → Display-2 title with **right-aligned
  "Total NN" mono meta** → content → full-bleed hairline. (Reference: "Popular …
  Total 06", "Gallery … Total 124".)
- **Bento composition:** lead with one **featured** tile, then an asymmetric mosaic;
  insert exactly one coral-feature tile and ≥1 cover tile so it's never all-text.
- **Segmented category nav** (top): tabs with **count superscripts** ("Featured¹²"),
  **active = coral + 700**, **inactive = ghosted (`opacity:.35`)**; horizontal scroll,
  no scrollbar, snap. (Reference: "Featured¹² Popular⁶ Just arrived⁴".)
- **Sticky mini-player** docks bottom with the now-playing summary; expands to the
  full player. Never floats over content un-anchored (fixes the prior floating-toast
  collision).
- **≤7 items per chunk** with "Load more" still holds (§ Miller's law).

---

### 25.8 Signature elements & patterns

- **Count badge / superscript.** Mono, `0.55em`, raised; coral on active, `--ink-3`
  otherwise. On tabs ("Featured¹²") and filter pills ("All · 12").
- **Avatar stack.** Overlapping 28–32px circles with `-8px` margin + "+8650 people"
  in mono micro-label. White ring (`2px var(--surface)`) between avatars.
- **Waveform scrubber** (primary audio control). Vertical bars: **played =
  `--ink`**, **upcoming = `--ink` @ 24%**, **playhead = `--coral-500`** with a mono
  timecode bubble ("06:21") above it. Tap/drag to seek; bars animate subtly while
  playing. Buffered = `--ink @ 12%`. Replaces the 4px native range input.
- **Equalizer** (now-playing affordance). 4–6 coral bars animating off audio level;
  pure decoration of state — `aria-hidden`, frozen under reduced-motion.
- **Search field.** Pill, `--surface-muted`; leading **circular** `Search` icon
  button; placeholder in `--ink-3` ("Find what you love").
- **Source/type tag.** Small pill, soft accent fill + ink-on-fill (one Chip recipe —
  unify the current DocCard vs Chip divergence).
- **Progress.** Two forms: (a) **coral ring** (reuse `StreakRing` arc) on cards/avatars;
  (b) thin `--coral-500` rail + draggable dot in the player. Always paired with a mono
  "X% · Y min left".
- **Empty / locked state.** Centered line icon (`EyeOff` for premium-locked) + one
  honest line + one `secondary` pill. Aspirational, never blank, never a dead end.
- **Status / "now" markers.** Mono uppercase micro-label ("NOW PLAYING", "NEXT",
  "PLAYING…") — the technical voice. Never sentence-case for these markers.

---

### 25.9 Motion

Reuse the motion tokens (`duration` 80–480ms, `easing.out/spring`). Specifics:
- Press: `scale(.97)`, `duration.instant`. Hover lift: `translateY(-2px)` + `--elev-2`,
  `duration.fast ease-out`.
- Karaoke word: color/bg only, `duration.highlight` (120ms) — **never font-weight**
  (avoids reflow).
- Waveform/equalizer: continuous, `aria-hidden`; **frozen under `prefers-reduced-motion`**
  (JS rAF must check `matchMedia`, not just CSS).
- Tile/list enter: 8px rise + fade, staggered ≤60ms, capped.
- Theme/page transitions: cross-fade `duration.base`. No layout-shifting transitions
  (transform/opacity only).

---

### 25.10 Token additions (drop-in)

```css
:root {
  /* coral ramp */
  --coral-050:#FFF1ED; --coral-100:#FFE3DC; --coral-500:#FF5C44;
  --coral-600:#D83A22; --coral-700:#B82E18; --coral-900:#4A1B0C;
  /* editorial accents */
  --lime:#C7F03F; --lime-soft:#EAF7B0; --lime-ink:#34400A;
  /* text */
  --ink:#0E0F12; --ink-2:#5C6068; --ink-3:#646871;
  --hairline:rgba(14,15,18,.08); --hairline-strong:rgba(14,15,18,.16);
  /* radius */
  --r-thumb:12px; --r-card:20px; --r-tile:24px; --r-sheet:28px; --r-squircle:22px;
  --r-pill:9999px;
  /* elevation */
  --elev-1:0 1px 2px rgba(14,15,18,.05);
  --elev-2:0 6px 20px rgba(14,15,18,.08);
  --elev-3:0 16px 40px rgba(14,15,18,.12);
  /* type */
  --font-mono:"Geist Mono","JetBrains Mono",ui-monospace,monospace;
}
```
Tailwind: extend `colors.coral.{50,100,500,600,700,900}`, `colors.lime.*`,
`boxShadow.{elev1,elev2,elev3}` (+ alias `soft`→elev2), `borderRadius.{thumb,tile,sheet,squircle}`,
`fontFamily.mono`, `fontWeight` allow 800. Point all accent colors at the CSS vars
(so themes/eink can remap).

---

### 25.11 v2 acceptance checklist (per screen)

- [ ] Largest element is a content **title** (Display), not chrome.
- [ ] Exactly **one coral moment**; secondary accent (if any) ≤1, on a tile not a control.
- [ ] Every button is a **pill**; every icon button is a **circle**; one height per context.
- [ ] **Zero** unicode/emoji/text-glyph icons — Lucide only, one stroke.
- [ ] Numerals/timecodes/counts are **mono + tabular**; section meta is "Total NN".
- [ ] Sections lead with an **eyebrow micro-label**; dividers are hairlines, not boxes.
- [ ] Cards carry **cover art** (no all-text grids); active row uses the peach pattern.
- [ ] Reading column untouched: 16–18px / 1.5–1.6 / 66ch / weight 400.
- [ ] Elevation from the scale; one sanctioned gradient max; focus ring traces the shape.
- [ ] Contrast: body 4.5:1, coral text via `--coral-700`, CTA fill `--coral-600`.

---

### 25.12 What this amends (reconciliation)

| Earlier rule | v2 |
|---|---|
| "Inter is the only family" | Inter stays for all text/display; **add a mono** (`--font-mono`) for figures/timecodes/counts/micro-labels only. *(Ratify as a new D-decision.)* |
| Weights implied minimal | Fixed set **400/500/600/700/800**; 800 reserved for Display. |
| Accents hard-coded hex | Accents are **CSS variables** so themes (esp. e-ink) can remap; e-ink drops all accents to grayscale. |
| Coral as a single value | Coral is a **ramp**; `500` big fills, `600` CTAs, `700` text. |
| "No gradient" lean | **One** sanctioned surface→muted gradient on hero/now-playing/cover surfaces. |
| `shadow-soft` (undefined) | Replaced by the **`--elev-1/2/3`** scale (alias `soft`→`elev-2`). |
| One bright + two pastel accents | One **coral** (always) + **≤1 editorial accent** per screen, on tiles only. |
| Card radius 20px default | Unchanged; tiles `24`, sheets `28`, thumbs `12` — codified. |

Everything else in §1–§24 stands. When §25 and an earlier section conflict, §25 wins.

---

**End of design system document.**

> When in conflict, this document wins. When new components are introduced, add them to §11 first with their variants and tokens, then build.
