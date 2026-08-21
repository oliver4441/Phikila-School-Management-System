# AI Features — UI Wireframes & Component Specs

**Date:** August 20, 2026
**Design System:** Phikila (DM Sans + Playfair Display, navy/emerald/gold palette)

---

## Table of Contents

1. [Global Floating Chat Widget](#1-global-floating-chat-widget)
2. [Super Admin AI Panel](#2-super-admin-ai-panel)
3. [Module-Specific AI Integrations](#3-module-specific-ai-integrations)
4. [CSS Class Reference](#4-css-class-reference)
5. [Component File Map](#5-component-file-map)

---

## 1. Global Floating Chat Widget

### 1.1 Component: `AiChatWidget.tsx`

**Location:** Fixed position, bottom-right corner of every authenticated page.

### 1.2 States

#### State A: Collapsed (Bubble)

```
┌─────────────────────────┐
│                         │
│                         │
│                    ┌──┐ │
│                    │✦ │ │  ← Floating bubble (48×48px)
│                    └──┘ │     brand-emerald background
│                         │     white SparkIcon
│                         │     subtle shadow-lg
│                         │     pulse animation on new message
└─────────────────────────┘
```

**CSS:** `.ai-chat-bubble`
- Fixed: `bottom: var(--space-5); right: var(--space-5);`
- Size: `3rem × 3rem` (matches `--tap-target`)
- Background: `var(--brand-emerald)` (`#12a47c`)
- Color: `#fff`
- Border-radius: `50%`
- Box-shadow: `var(--shadow-lg)`
- z-index: `60` (above toasts at 70? No — toasts are 70, chat should be 65)
- Hover: scale 1.05, shadow-xl
- New message indicator: small red dot badge (top-right, 8px)

#### State B: Open (Chat Panel)

```
┌──────────────────────────────────────┐
│  ✦ Phikila AI                   ─  ✕ │  ← Header bar
├──────────────────────────────────────┤
│ 42 / 50 messages used today          │  ← Rate limit indicator
│ ████████████████░░░░ 84%             │     (progress bar)
├──────────────────────────────────────┤
│                                      │
│  ┌─────────────────────────────┐     │
│  │ 👋 Hi! I'm Phikila AI.     │     │  ← Welcome message (first time)
│  │ Ask me about students,     │     │     card style, muted bg
│  │ grades, attendance, or     │     │
│  │ finances.                  │     │
│  └─────────────────────────────┘     │
│                                      │
│         ┌───────────────────────┐    │
│         │ How is Form 3A doing  │    │  ← User message (right-aligned)
│         │ in Mathematics?       │    │     primary-soft bg, primary border
│         └───────────────────────┘    │
│                                      │
│  ┌─────────────────────────────┐     │
│  │ Based on the examination    │     │  ← AI response (left-aligned)
│  │ data for Term 2:            │     │     surface-muted bg
│  │                             │     │
│  │ **Form 3A — Mathematics**   │     │     Markdown rendered
│  │ • Average: 72%              │     │
│  │ • Highest: 91% (Jane M.)   │     │
│  │ • Lowest: 38% (Peter K.)   │     │
│  │                             │     │
│  │ ⚠ 3 students scored below  │     │     Warning callout
│  │   50% and may need support. │     │
│  │                             │     │
│  │ [📄 Export as report]       │     │     Action button
│  └─────────────────────────────┘     │
│                                      │
│  ┌─ · ─· ─· ─┐                      │  ← Typing indicator (3 bouncing dots)
│                                      │
├──────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌────┐ │
│ │ Ask anything about your  │ │ ➤  │ │  ← Input area
│ │ school…                  │ │    │ │     textarea, auto-grow
│ └──────────────────────────┘ └────┘ │     Send button (primary bg)
└──────────────────────────────────────┘
```

### 1.3 Detailed Layout Spec

#### Chat Panel Container

| Property | Value |
|----------|-------|
| Position | `fixed` |
| Bottom | `var(--space-5)` (1.5rem) |
| Right | `var(--space-5)` (1.5rem) |
| Width | `24rem` (384px) on desktop, `calc(100vw - 2rem)` on mobile |
| Max-height | `min(32rem, calc(100vh - 6rem))` |
| Border-radius | `var(--radius-lg)` (1rem) |
| Border | `1px solid var(--color-line)` |
| Background | `var(--color-surface)` |
| Box-shadow | `var(--shadow-lg)` |
| z-index | `65` |
| Display | `flex; flex-direction: column;` |
| Animation | `slide-up 200ms ease-out` |

#### Header

| Property | Value |
|----------|-------|
| Height | `3.5rem` |
| Padding | `0 var(--space-4)` |
| Background | `var(--brand-navy-deep)` |
| Color | `#fff` |
| Display | `flex; align-items: center; justify-content: space-between;` |
| Border-bottom | `none` (clean look) |

- Left: SparkIcon (18px) + "Phikila AI" text (font-weight: 700, font-size: 0.95rem)
- Right: Minimize button (− icon) + Close button (✕ icon)
- Both buttons: `icon-button--subtle` with white color

#### Rate Limit Bar

| Property | Value |
|----------|-------|
| Padding | `var(--space-2) var(--space-4)` |
| Background | `var(--color-surface-muted)` |
| Border-bottom | `1px solid var(--color-line)` |
| Font-size | `0.78rem` |
| Color | `var(--color-ink-muted)` |

- Text: "42 / 50 messages used today"
- Progress bar below text: height `0.35rem`, border-radius `999px`
  - Fill: `var(--brand-emerald)` when < 80%
  - Fill: `var(--color-warning)` when 80–95%
  - Fill: `var(--color-danger)` when > 95%
- Hidden when rate limit info is unavailable

#### Message Area

| Property | Value |
|----------|-------|
| Flex | `1` (fills remaining space) |
| Overflow-y | `auto` |
| Padding | `var(--space-4)` |
| Display | `flex; flex-direction: column; gap: var(--space-3);` |

**User messages:**
- Align: `align-self: flex-end;`
- Max-width: `85%`
- Background: `var(--color-primary-soft)`
- Border: `1px solid var(--color-primary)`
- Border-radius: `var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md)`
- Padding: `var(--space-2) var(--space-3)`
- Font-size: `0.9rem`

**AI messages:**
- Align: `align-self: flex-start;`
- Max-width: `90%`
- Background: `var(--color-surface-muted)`
- Border: `1px solid var(--color-line)`
- Border-radius: `var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-sm)`
- Padding: `var(--space-3)`
- Font-size: `0.9rem`
- Markdown rendered: bold, lists, code blocks styled

**Welcome message (first interaction):**
- Same as AI message style
- Contains: greeting text, example prompts as clickable chips

#### Typing Indicator

- Three dots in a row, bouncing animation
- Background: `var(--color-surface-muted)`
- Border-radius: `var(--radius-md)`
- Padding: `var(--space-2) var(--space-3)`
- Each dot: `0.4rem` circle, `var(--color-ink-muted)`, staggered `animation-delay`

#### Input Area

| Property | Value |
|----------|-------|
| Padding | `var(--space-3) var(--space-4)` |
| Border-top | `1px solid var(--color-line)` |
| Background | `var(--color-surface)` |
| Display | `flex; align-items: flex-end; gap: var(--space-2);` |

- Textarea: auto-grows from 1 line to max 4 lines
  - Class: `ai-chat__input`
  - Border: `1px solid var(--color-line-strong)`
  - Border-radius: `var(--radius-md)`
  - Padding: `var(--space-2) var(--space-3)`
  - Font-size: `0.9rem`
  - Resize: `none`
  - Max-height: `6rem`
- Send button: `3rem × 3rem`, `var(--brand-emerald)` background, white arrow icon
  - Disabled when input is empty or AI is responding
  - Shows spinner when sending

### 1.4 Interaction Flow

```
User clicks bubble
  → Panel opens with slide-up animation
  → Focus moves to input field
  → Load recent chat history (GET /api/v1/ai/chat/history)

User types message + presses Enter (or clicks Send)
  → Message appears in chat area (optimistic)
  → Input clears, typing indicator appears
  → POST /api/v1/ai/chat (SSE stream)
  → Tokens render in real time (character by character)
  → On stream complete:
    → Typing indicator disappears
    → Rate limit counter updates
    → Scroll to bottom

User clicks "Export as report"
  → POST /api/v1/ai/reports/generate
  → Loading spinner on button
  → On success: download modal with format options (MD/PDF/DOCX)

User clicks example chip
  → Fills input with that text
  → Focuses input

User clicks minimize (−)
  → Panel slides down, bubble reappears
  → Chat state preserved (no re-render)

User clicks close (✕)
  → Panel closes, bubble reappears
  → Chat state preserved

User scrolls to top of messages
  → Load older messages (pagination)
```

### 1.5 Mobile Behavior (< 640px)

```
┌────────────────────────────┐
│  ✦ Phikila AI         ─  ✕│
├────────────────────────────┤
│                            │
│  (chat messages, full      │
│   width, same layout)      │
│                            │
├────────────────────────────┤
│ ┌────────────────────┐┌──┐│
│ │ Ask anything…      ││ ➤││
│ └────────────────────┘└──┘│
└────────────────────────────┘
```

- Panel takes `width: calc(100vw - 1rem); left: 0.5rem; right: 0.5rem;`
- Bottom: `var(--space-3)` (above bottom nav)
- Max-height: `calc(100vh - 5rem)` (leaves room for bottom nav)

---

## 2. Super Admin AI Panel

### 2.1 Page: `AiAdminPage.tsx`

**Route:** `/settings/ai`
**Access:** Super admin only

### 2.2 Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Breadcrumbs: Settings > AI Configuration               │
│                                                         │
│  AI Configuration                                       │
│  Manage language model providers, rate limits, and      │
│  feature toggles for all schools.                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Tab Bar ─────────────────────────────────────────┐  │
│  │ [Providers] [Rate Limits] [Features] [Usage] [Audit]│ │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  (Tab content below)                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Tab bar:**
- Horizontal list of tab buttons
- Active tab: `var(--brand-navy)` background, white text
- Inactive: `var(--color-surface)` background, `var(--color-ink)` text
- Border-bottom: `2px solid var(--color-line)` on inactive, `2px solid var(--brand-navy)` on active

### 2.3 Tab: Providers

Extends the existing `LlmProvidersPage` with actual key storage.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Language Model Providers                               │
│  Connect providers and manage API keys. Keys are        │
│  encrypted at rest and never sent to the browser.       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔑 Global Default Provider                       │   │
│  │                                                   │   │
│  │ Provider:  [Google Gemini      ▾]                 │   │
│  │ Model:     [gemini-2.0-flash   ▾]                 │   │
│  │                                                   │   │
│  │ API Key:  ••••••••••••••••••••  [Replace] [Test] │   │
│  │ Status:   ✅ Connected (tested 2 min ago)         │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🏫 Per-School Overrides                          │   │
│  │                                                   │   │
│  │ School          Provider      Status    Actions   │   │
│  │ ─────────────── ───────────── ──────── ─────────  │   │
│  │ Phikila Prep    (global)      —         [Set Key] │   │
│  │ Phikila Academy OpenAI        ✅ Active  [Manage] │   │
│  │                                                   │   │
│  │ [+ Add school override]                           │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📊 Provider Comparison                           │   │
│  │                                                   │   │
│  │ Provider      Free Tier        Speed    Cost/M    │   │
│  │ ───────────── ──────────────── ──────── ───────── │   │
│  │ Google Gemini 15 RPM, 1M tok/d Fast     $0.075   │   │
│  │ Groq          30 RPM, 14K req/d V.Fast  $0.059   │   │
│  │ OpenAI        $5 credit       Medium    $0.15    │   │
│  │ Anthropic     —               Medium    $0.25    │   │
│  │ Cloudflare    10K req/d       Fast      Free     │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Provider selector: `input--select` dropdown
- API key field: `PasswordField` component (existing)
- Status badge: `Badge` component with `success`/`danger`/`neutral` tone
- Table: existing `.table` class with `.table-wrap`

### 2.4 Tab: Rate Limits

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Rate Limits                                            │
│  Control how many AI requests users and schools can     │
│  make per day.                                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ⚙ Global Defaults                                │   │
│  │                                                   │   │
│  │ Per user:    [50] requests / day                  │   │
│  │ Per school:  [500] requests / day                 │   │
│  │                                                   │   │
│  │ [Save defaults]                                   │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🏫 School Overrides                               │   │
│  │                                                   │   │
│  │ School          User Limit   School Limit  Actions│   │
│  │ ─────────────── ──────────── ──────────── ─────── │   │
│  │ Phikila Prep    50/day       500/day       Edit   │   │
│  │ Phikila Academy 100/day      1000/day      Edit   │   │
│  │                                                   │   │
│  │ [+ Add school override]                           │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📈 Current Usage (Today)                          │   │
│  │                                                   │   │
│  │ School          Used / Limit    Bar               │   │
│  │ ─────────────── ────────────── ────────────────── │   │
│  │ Phikila Prep    127 / 500      ████████░░░░░ 25% │   │
│  │ Phikila Academy 412 / 1000     █████████████░ 41% │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Number inputs: `input` class with `type="number"`, `min="1"`, `max="10000"`
- Usage bars: `.dashboard-progress` and `.dashboard-progress__bar` classes
- Table: existing `.table` class

### 2.5 Tab: Features

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Feature Toggles                                        │
│  Enable or disable AI features globally or per school.  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🌐 Global Defaults                                │   │
│  │                                                   │   │
│  │ Feature              Enabled  Description         │   │
│  │ ──────────────────── ──────── ──────────────────  │   │
│  │ ☑ Chat assistant     ✅ On    Ask questions about  │   │
│  │                                  school data       │   │
│  │ ☑ Report generation  ✅ On    Generate markdown,   │   │
│  │                                  PDF, Word docs    │   │
│  │ ☑ Grade analytics    ✅ On    Predictions &        │   │
│  │                                  performance trends │   │
│  │ ☑ Finance insights   ✅ On    Payment matching &   │   │
│  │                                  anomaly detection  │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🏫 Per-School Overrides                           │   │
│  │                                                   │   │
│  │ School          Chat  Reports  Grades  Finance    │   │
│  │ ─────────────── ───── ──────── ─────── ─────────  │   │
│  │ Phikila Prep    ✅    ✅       ✅      ❌         │   │
│  │ Phikila Academy ✅    ✅       ✅      ✅         │   │
│  │                                                   │   │
│  │ [Edit] on each row opens inline toggles           │   │
│  │                                                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Toggle switches: custom CSS toggle (checkbox + label)
  - On: `var(--brand-emerald)` background, white dot
  - Off: `var(--color-line)` background, gray dot
  - Size: `2.5rem × 1.25rem`
- Feature descriptions: `var(--color-ink-muted)`, `font-size: 0.8125rem`

### 2.6 Tab: Usage

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Usage Analytics                                        │
│  Monitor AI usage across all schools.                   │
│                                                         │
│  ┌─── Summary Cards ─────────────────────────────────┐  │
│  │                                                    │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│  │
│  │ │ Total    │ │ Schools  │ │ Avg/User │ │ Tokens ││  │
│  │ │ Requests │ │ Active   │ │ Per Day  │ │ Used   ││  │
│  │ │ 1,247    │ │ 2        │ │ 18.3     │ │ 2.4M   ││  │
│  │ │ today    │ │          │ │          │ │        ││  │
│  │ └──────────┘ └──────────┘ └──────────┘ └────────┘│  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── Usage by School (last 7 days) ─────────────────┐  │
│  │                                                    │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │          ▓▓▓                                │  │  │
│  │  │  ▓▓▓     ▓▓▓     ▓▓▓                      │  │  │
│  │  │  ▓▓▓     ▓▓▓     ▓▓▓     ▓▓▓              │  │  │
│  │  │  ▓▓▓     ▓▓▓     ▓▓▓     ▓▓▓     ▓▓▓      │  │  │
│  │  │──▓▓▓─────▓▓▓─────▓▓▓─────▓▓▓─────▓▓▓──────│  │  │
│  │  │ Mon  Tue  Wed  Thu  Fri  Sat  Sun          │  │  │
│  │  │                                              │  │  │
│  │  │ ■ Phikila Prep   ■ Phikila Academy          │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── Usage by Feature ──────────────────────────────┐  │
│  │                                                    │  │
│  │  Feature          Requests   Tokens    Avg Latency│  │
│  │  ──────────────── ────────── ───────── ────────── │  │
│  │  Chat             892        1.8M      1.2s       │  │
│  │  Reports          214        420K      3.8s       │  │
│  │  Grade analytics  98         180K      2.1s       │  │
│  │  Finance insights 43         95K       1.9s       │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── Recent Activity ───────────────────────────────┐  │
│  │                                                    │  │
│  │  Time       User              Feature    Tokens   │  │
│  │  ────────── ───────────────── ────────── ──────── │  │
│  │  14:32      admin@phikila.com Chat       342      │  │
│  │  14:28      teacher@phikila   Grades     189      │  │
│  │  14:15      admin@phikila.com Reports    1,204    │  │
│  │  14:02      finance@phikila   Finance    567      │  │
│  │                                                    │  │
│  │  [Load more]                                       │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Summary cards: `.dashboard-metric` class (existing)
- Bar chart: simple CSS bars (no chart library — keep bundle small)
  - Each bar: `var(--brand-navy)` for school 1, `var(--brand-emerald)` for school 2
  - Bar height: proportional to max value
  - Labels below bars
- Tables: existing `.table` class

### 2.7 Tab: Audit Log

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  AI Audit Log                                           │
│  Searchable log of all AI interactions across schools.   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔍 [Search by user, school, or feature...     ] │   │
│  │                                                   │   │
│  │ Filter: [All schools ▾] [All features ▾] [Date ▾]│   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── Table ─────────────────────────────────────────┐  │
│  │                                                    │  │
│  │ Time     School      User           Action   Status│  │
│  │ ──────── ─────────── ────────────── ──────── ─────│  │
│  │ 14:32    Prep        admin@…        chat     ✅    │  │
│  │ 14:28    Academy     teacher@…      grades   ✅    │  │
│  │ 14:15    Prep        admin@…        report   ✅    │  │
│  │ 14:02    Academy     finance@…      finance  ❌    │  │
│  │          │                                            │  │
│  │          └─ Error: "Rate limit exceeded" (expand)   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  Showing 1–50 of 1,247                                   │
│  [← Previous] [Next →]                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Search: `.input--search` class (existing)
- Filters: `.chip-toggle` class for filter chips
- Table: existing `.table` class
- Pagination: existing `.pagination` class
- Error expand: clickable row reveals error detail (accordion-style)

---

## 3. Module-Specific AI Integrations

### 3.1 Examinations Page — Grade Analytics

**Location:** Button in the exam results header area.

```
┌─────────────────────────────────────────────────┐
│  Term 2 End of Term Exams                       │
│                                                 │
│  [Export] [AI Analysis ✦]                       │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  (When "AI Analysis" is clicked:)               │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ ✦ Grade Analysis — Term 2 Exams           │  │
│  │                                           │  │
│  │ ⚠ Students at risk (3):                  │  │
│  │                                           │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │ Peter K. — Mathematics: 38%        │  │  │
│  │  │ Trend: ↓ 15% from Term 1           │  │  │
│  │  │ Recommendation: Extra tutoring      │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │ Grace W. — Science: 42%            │  │  │
│  │  │ Trend: ↓ 8% from Term 1            │  │  │
│  │  │ Recommendation: Parent conference   │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                           │  │
│  │ 📊 Class averages:                        │  │
│  │  • Mathematics: 72% (↑ 3%)               │  │
│  │  • English: 68% (↓ 2%)                   │  │
│  │  • Science: 71% (↑ 1%)                   │  │
│  │                                           │  │
│  │ [📄 Export full analysis] [✕ Dismiss]     │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Button style:** `button--secondary` with SparkIcon prefix
**Analysis panel:** `card section` class, positioned inline (not modal)
**Student cards:** `.record-card` class with left border color based on severity

### 3.2 Finance Page — Payment Matching

**Location:** Button in the payment inbox header.

```
┌─────────────────────────────────────────────────┐
│  Payment Inbox                                   │
│                                                 │
│  [Auto-Match ✦]  [Import]  [Export]             │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  (When "Auto-Match" is clicked and matches      │
│   are found:)                                   │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ ✦ Suggested Matches (3)                   │  │
│  │                                           │  │
│  │ ┌─────────────────────────────────────┐   │  │
│  │ │ Payment: John Kamau — KES 10,000   │   │  │
│  │ │ Match:   INV-1-2026-100 (Form 1A) │   │  │
│  │ │ Confidence: 95%                    │   │  │
│  │ │ [✅ Approve] [❌ Reject] [View]    │   │  │
│  │ └─────────────────────────────────────┘   │  │
│  │ ┌─────────────────────────────────────┐   │  │
│  │ │ Payment: Mary Njeri — KES 25,000   │   │  │
│  │ │ Match:   INV-1-2026-103 (Form 2A) │   │  │
│  │ │ Confidence: 82%                    │   │  │
│  │ │ [✅ Approve] [❌ Reject] [View]    │   │  │
│  │ └─────────────────────────────────────┘   │  │
│  │ ┌─────────────────────────────────────┐   │  │
│  │ │ Payment: Equity Bank — KES 68,000  │   │  │
│  │ │ Match:   INV-2-2026-100 (Form 4A) │   │  │
│  │ │ Confidence: 71%                    │   │  │
│  │ │ ⚠ Low confidence — review needed   │   │  │
│  │ │ [✅ Approve] [❌ Reject] [View]    │   │  │
│  │ └─────────────────────────────────────┘   │  │
│  │                                           │  │
│  │ [✅ Approve all high-confidence] [✕ Cancel]│  │
│  └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Button style:** `button--primary` with SparkIcon prefix
**Match cards:** `card section` class
- Confidence ≥ 80%: green left border (`var(--color-success)`)
- Confidence < 80%: yellow left border (`var(--color-warning)`) + warning alert

### 3.3 Finance Dashboard — AI Summary Panel

**Location:** Additional panel on the finance page.

```
┌─────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────┐  │
│  │ ✦ AI Finance Summary — Term 2             │  │
│  │                                           │  │
│  │ 💰 Collection rate: 78%                   │  │
│  │ 📋 Outstanding: KES 234,000 (12 invoices)│  │
│  │ ⚠ Overdue: 3 invoices (oldest: 45 days)  │  │
│  │                                           │  │
│  │ Anomalies detected:                       │  │
│  │ • Duplicate payment reference detected    │  │
│  │   (PAY-1-2026-200 and PAY-2-2026-200)    │  │
│  │                                           │  │
│  │ [📄 Export summary] [🔄 Refresh]          │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 3.4 Report Generation — Export Modal

**Location:** Triggered from chat widget or module pages.

```
┌─────────────────────────────────────────────┐
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📄 Export Report                      │  │
│  │                                       │  │
│  │  Format:                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────┐ │  │
│  │  │ 📝       │ │ 📕       │ │ 📘    │ │  │
│  │  │ Markdown │ │ PDF      │ │ Word  │ │  │
│  │  │ .md      │ │ .pdf     │ │ .docx │ │  │
│  │  └──────────┘ └──────────┘ └───────┘ │  │
│  │                                       │  │
│  │  Preview:                             │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ # Form 3A — Term 2 Report      │  │  │
│  │  │                                 │  │  │
│  │  │ **Average score:** 72%          │  │  │
│  │  │ **Students:** 42                │  │  │
│  │  │ **Pass rate:** 88%              │  │  │
│  │  │                                 │  │  │
│  │  │ ## Performance by Subject       │  │  │
│  │  │ ...                             │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                       │  │
│  │  [Download]  [Cancel]                 │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**Modal overlay:** `drawer-overlay` class (existing)
**Modal card:** centered, `max-width: 32rem`, `card section` class
**Format buttons:** `.chip-toggle` style, selected state with `--on` class

---

## 4. CSS Class Reference

### 4.1 New Classes (to add to `index.css`)

```css
/* ---- AI Chat Widget ---- */
.ai-chat-bubble {
  position: fixed;
  bottom: var(--space-5);
  right: var(--space-5);
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--brand-emerald);
  color: #fff;
  border: none;
  box-shadow: var(--shadow-lg);
  z-index: 65;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.ai-chat-bubble:hover {
  transform: scale(1.05);
  box-shadow: 0 18px 45px rgba(18, 164, 124, 0.3);
}

.ai-chat-bubble__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--color-danger);
  border: 2px solid var(--color-surface);
  font-size: 0;
}

.ai-chat-panel {
  position: fixed;
  bottom: var(--space-5);
  right: var(--space-5);
  width: 24rem;
  max-height: min(32rem, calc(100vh - 6rem));
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-line);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  z-index: 65;
  display: flex;
  flex-direction: column;
  animation: ai-chat-slide-up 200ms ease-out;
}

@keyframes ai-chat-slide-up {
  from { opacity: 0; transform: translateY(1rem); }
  to { opacity: 1; transform: translateY(0); }
}

.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--brand-navy-deep);
  color: #fff;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  flex-shrink: 0;
}

.ai-chat-header__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  font-size: 0.95rem;
}

.ai-chat-header__actions {
  display: flex;
  gap: var(--space-1);
}

.ai-chat-header__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.ai-chat-header__btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.ai-chat-limit {
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-line);
  font-size: 0.78rem;
  color: var(--color-ink-muted);
  flex-shrink: 0;
}

.ai-chat-limit__bar {
  height: 0.35rem;
  margin-top: var(--space-1);
  border-radius: 999px;
  background: var(--color-line);
  overflow: hidden;
}

.ai-chat-limit__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--brand-emerald);
  transition: width 300ms ease;
}

.ai-chat-limit__fill--warning {
  background: var(--color-warning);
}

.ai-chat-limit__fill--danger {
  background: var(--color-danger);
}

.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  scroll-behavior: smooth;
}

.ai-chat-msg {
  max-width: 90%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ai-chat-msg--user {
  align-self: flex-end;
  background: var(--color-primary-soft);
  border: 1px solid rgba(15, 42, 71, 0.2);
  border-radius: var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md);
  color: var(--color-ink);
}

.ai-chat-msg--ai {
  align-self: flex-start;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-sm);
  color: var(--color-ink);
}

.ai-chat-msg--ai strong {
  font-weight: 700;
}

.ai-chat-msg--ai ul,
.ai-chat-msg--ai ol {
  margin: var(--space-2) 0;
  padding-left: var(--space-4);
  list-style: disc;
}

.ai-chat-msg--ai li {
  margin-bottom: var(--space-1);
}

.ai-chat-welcome {
  align-self: flex-start;
  max-width: 90%;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-line);
  font-size: 0.9rem;
}

.ai-chat-typing {
  align-self: flex-start;
  display: flex;
  gap: 0.3rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.ai-chat-typing__dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--color-ink-muted);
  animation: ai-chat-bounce 1.2s ease-in-out infinite;
}

.ai-chat-typing__dot:nth-child(2) { animation-delay: 0.2s; }
.ai-chat-typing__dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes ai-chat-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-0.3rem); }
}

.ai-chat-input {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-line);
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-shrink: 0;
}

.ai-chat-input__field {
  flex: 1;
  min-height: 2.5rem;
  max-height: 6rem;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 0.9rem;
  resize: none;
  line-height: 1.4;
  overflow-y: auto;
}

.ai-chat-input__field:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(15, 42, 71, 0.18);
}

.ai-chat-input__send {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--brand-emerald);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 140ms ease;
}

.ai-chat-input__send:hover:not(:disabled) {
  background: var(--brand-emerald-light);
}

.ai-chat-input__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- AI Admin Panel ---- */
.ai-admin-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-line);
  margin-bottom: var(--space-4);
  overflow-x: auto;
}

.ai-admin-tab {
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  color: var(--color-ink-muted);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  transition: color 140ms ease, border-color 140ms ease;
}

.ai-admin-tab:hover {
  color: var(--color-ink);
}

.ai-admin-tab--active {
  color: var(--brand-navy);
  border-bottom-color: var(--brand-navy);
}

.ai-toggle {
  position: relative;
  display: inline-flex;
  width: 2.5rem;
  height: 1.25rem;
  border-radius: 999px;
  background: var(--color-line);
  cursor: pointer;
  transition: background 140ms ease;
}

.ai-toggle--on {
  background: var(--brand-emerald);
}

.ai-toggle__dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #fff;
  transition: transform 140ms ease;
}

.ai-toggle--on .ai-toggle__dot {
  transform: translateX(1.25rem);
}

/* ---- Mobile overrides ---- */
@media (max-width: 640px) {
  .ai-chat-panel {
    width: calc(100vw - 1rem);
    left: 0.5rem;
    right: 0.5rem;
    bottom: var(--space-3);
    max-height: calc(100vh - 5rem);
  }

  .ai-chat-bubble {
    bottom: var(--space-3);
    right: var(--space-3);
  }
}
```

---

## 5. Component File Map

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/components/AiChatWidget.tsx` | Floating chat bubble + panel |
| `frontend/src/components/AiChatMessage.tsx` | Individual message renderer (markdown) |
| `frontend/src/components/AiChatInput.tsx` | Auto-growing textarea + send button |
| `frontend/src/components/AiToggle.tsx` | Toggle switch component |
| `frontend/src/components/AiFormatPicker.tsx` | Report export format selector |
| `frontend/src/pages/AiAdminPage.tsx` | Super admin AI configuration page |
| `frontend/src/lib/ai.ts` | AI API client (chat, usage, admin endpoints) |
| `workers/src/routes/ai.ts` | Backend AI routes |
| `workers/src/lib/ai-provider.ts` | LLM provider abstraction |
| `workers/src/lib/ai-ratelimit.ts` | Rate limit enforcement |
| `workers/src/lib/ai-rag.ts` | RAG pipeline (DB queries + prompt composition) |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/components/AppShell.tsx` | Add `<AiChatWidget />` after `<PrintFooter />` |
| `frontend/src/App.tsx` | Add route for `/settings/ai` → `AiAdminPage` |
| `frontend/src/components/AppShell.tsx` | Add "AI Config" nav item under Platform (super admin only) |
| `workers/src/index.ts` | Mount `aiRoutes` at `/api/v1/ai` |
| `frontend/src/lib/api.ts` | Add AI-related API helpers |
