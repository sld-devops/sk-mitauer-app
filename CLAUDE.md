# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Toma Komasa Sportistu Portāls" (SK Mitauer Training Planner) — a training-plan web app for a coach and their athletes, deployed at `tksportisti.netlify.app`. Vanilla HTML/CSS/JS, no build step, no bundler, no framework, no test runner. Backend is Supabase (Postgres + Auth + Edge Functions).

It replaces a Google Sheets workflow the coach previously used to plan training for ~20-25 athletes, which was hard to track and not user-friendly. The goal is to make the coach-athlete relationship more transparent and efficient: let the coach build precise, individualized training plans quickly (athletes have very different fitness levels) and let athletes follow their plan easily. Favor changes that reduce clicks/time for the coach's day-to-day planning flow and keep per-athlete data clearly distinguished — that's the app's core value over the spreadsheet it replaced.

The project owner is not a programmer and cannot review JavaScript diffs themselves — they rely on Claude to self-verify correctness and to explain changes in plain, non-technical language (in Latvian). This is their first project working with any code agent, so err on the side of caution, small steps, and clear explanations over assumed technical fluency.

## Commands

There is no package.json, npm, linter, formatter, or CI. The only "command" is opening the app:

```bash
xdg-open index.html
```

Because the app calls Supabase directly from the browser (see `auth.js`), opening `index.html` as a local file works against the live Supabase project — there is no local/mock backend. A test account ("Testa Sportists") exists and is safe to use for testing writes; use it rather than a real athlete's account.

## Architecture

Flat files, loaded in this order from `index.html`:

1. **`auth.js`** — Supabase client init, login/logout, password change. Defines `currentUser`, `currentProfile`, `isCoach()`, `showApp()`/`showAuth()`.
2. **`db.js`** — all Supabase queries (one thin async function per table operation, e.g. `getPlans`, `insertPlan`, `updateRestriction`). This is the only file that talks to `supabase.from(...)` — treat it as the data-access layer and add new queries here rather than inlining `supabase.from()` calls in `app.js`.
3. **`panels/*.js`** — feature areas extracted out of `app.js` (see "Splitting `app.js` into smaller files" below), e.g. `panels/self-tests.js`, `panels/polar-tests.js`, `panels/health-journal.js`, `panels/lab-tests.js`, `panels/diary.js`, `panels/records.js`. Each still uses the same shared global scope as `app.js` (plain `<script>` tags, no modules/imports) — they just physically separate one panel's state + render + event-wiring code into its own file. **These must load before `app.js`**, because `app.js` contains the top-level "is someone already logged in?" check that can call these panels' `render*()` functions almost immediately; if `app.js` loaded first, a fast-resolving session check could try to call a not-yet-defined function.
4. **`app.js`** (~5800 lines and shrinking) — everything not yet extracted into `panels/`: global mutable state (`let athletes = []`, `plans`, `templates`, `restrictions`, `weeklyTrend`, etc. declared at the top), all rendering (`render*` functions that rebuild DOM from state), and all event wiring. No components, no virtual DOM — state mutation is followed by manually calling the relevant `render*()` function.
5. **`styles.css`** — all styles, using CSS custom properties for the design system.

`index.html` is the entrypoint: static DOM shell for both the `#authView` and `#appView` (all panels/sections/dialogs are pre-declared in HTML and toggled via `hidden`), plus the `<script>` tags loading the Supabase JS SDK, then `db.js`, `auth.js`, any `panels/*.js` files, then `app.js` last.

### Data flow pattern

Global arrays in `app.js` (`plans`, `templates`, `athletes`, `restrictions`, `dayNotes`, `logEntries`, etc.) are the in-memory cache of Supabase tables, scoped to the currently selected athlete/week/month. The typical flow for a feature is:

- a `db.js` function fetches/mutates rows in Supabase
- the caller in `app.js` reassigns the relevant global array
- the caller then invokes the matching `render*()` function to redraw that section

`loadAllData()` / `loadNonTemplateData()` / `loadWeekOverviewPlanData()` in `app.js` are the main data-loading entry points, called on login and when the selected athlete/week/view changes.

### Roles

Two roles: `coach` and `athlete` (`currentProfile.role`, checked via `isCoach()`). The coach manages multiple athletes (selects one via the athlete dropdown, sees an admin panel for creating/deleting athlete accounts). An athlete sees only their own data. Many `render*` functions branch on `isCoach()` to show/hide coach-only controls.

### Supabase backend

- `auth.js` connects to a fixed Supabase project (URL + anon key hardcoded). Auth uses synthetic emails (`username@skmitauer.app`) with `localStorage`/`sessionStorage` swapped based on a "remember me" checkbox.
- `supabase/functions/` holds three Deno Edge Functions requiring the caller to be an authenticated coach: `create-user`, `delete-user`, `reset-password`. These exist because creating/deleting Supabase Auth users needs the service-role key, which must never reach the browser.
- Core tables referenced from `db.js`: `profiles`, `plans`, `templates`, `races`, `records`, `log_entries`, `weekly_summaries`, `day_notes`, `restrictions`, `diary_entries`, `self_tests`, `polar_tests`, `health_entries`, `lab_tests`, `week_block_types`.

### Restrictions have day-part granularity

A `restrictions` row can block a whole day or just one part (`time_of_day`: null = whole day, else morning/midday/evening). Check `isTimeSlotRestricted(dateStr, tod)`, `isDayFullyRestricted(dateStr)`, and `getRestrictedTods(dateStr)` in `app.js` before adding new scheduling logic that touches restrictions.

### Notification badges (unseen-entry count on collapsible sidebar panels)

Seven sidebar panels (Restrictions, Health journal, Diary, Records, Self-tests, Polar-tests, Lab tests) show a small red "N" badge on their header when the coach has entries they haven't looked at yet. The pattern, consistent across all seven — follow it exactly when adding a new one:

- **State**: a `seen<Thing>Ids` Set (or `readDiaryEntryIds`), persisted to `localStorage` (not Supabase — per-browser, not per-account). Loaded once at script-load time via a `loadSeen<Thing>Ids()` call.
- **Marking as seen**: `mark all as seen` fires from the generic panel-collapse click handler in `app.js` (search `wasCollapsed && !panel.classList.contains("collapsed")`), *only* when `activeRole === "coach"` and only on the collapsed→expanded transition. Athletes never see their own "new entry" badge by design.
- **Important gotcha**: opening a panel to check whether something is there **is itself** the action that clears its badge. When debugging a "badge not showing" report, don't expand-and-look — that destroys the evidence. Inspect the DOM (`data-count` attribute) without clicking, or check with a fresh page load you haven't touched.
- **Computing the badge**: each panel's `render*()` function computes `unseen = items.filter(i => !isXSeen(...)).length`, then sets `panel.classList.toggle("has-entries", unseen > 0)` and writes the count as `data-count` on the panel's **`.panel-header`** element (not `.collapse-toggle` — see below).
- **CSS**: `#panelId.has-entries .panel-header::after { content: attr(data-count); ... }`, gated on the `has-entries` class (or `has-restrictions` for the Restrictions panel specifically).

**Why `.panel-header` and not `.collapse-toggle`:** the badge used to be attached to the small ▶/▼ toggle button. As of 2026-07-14, `.planner-panel .collapse-toggle { display: none; }` intentionally hides that button (the whole panel header is clickable instead — see the `"Panel header click (whole area toggles, not just arrow)"` listener in `app.js`). A `display: none` element cannot render pseudo-elements, so a badge attached to a hidden element can never show, no matter how correct the has-entries computation is. If you ever see a badge silently fail to appear, check whether its anchor element got hidden by an unrelated CSS change before assuming the JS logic is wrong.

### Sidebar panel visual conventions (rows, buttons, sizing)

When building or restyling a list-style panel body in the sidebar (the narrow ~300px column), follow the pattern refined in `panels/lab-tests.js` / the `.labtest-*` rules in `styles.css` (added 2026-07-15) as the reference implementation, rather than inventing new spacing/sizing from scratch:

- **The panel's own "add new entry" button** uses `class="secondary-action panel-add-btn"` (both in `styles.css`) — `.secondary-action` gives the light neutral background/thin border instead of `.primary-action`'s solid red/bold (that's reserved for prominent calls-to-action elsewhere, like dialog save buttons — a bold red button for a routine, low-frequency "add" action inside a compact sidebar panel reads as too attention-grabbing), and `.panel-add-btn` is the shared compact-sizing class (smaller font/padding, `width: auto`, its own `margin-top` for spacing above it) used by every panel's add button (lab tests, self-tests, polar-tests, health journal) — extend that one shared class rather than adding a new per-button override each time. No "+" prefix on the label, and the label text itself is always exactly **"Pievienot"** — not "Pievienot paštestu" / "Pievienot ierakstu" / etc. — the same word in every panel, regardless of what's being added (confirmed with the owner 2026-07-15: they want this literally uniform across sections, not just similarly styled). **Placement: always at the bottom of the panel body, after the entry list** (not above it) — moved there 2026-07-15 per the owner's explicit feedback that having it above the list in some panels and below in others (Diary already had it at the bottom, since its "add" form is always inline rather than a dialog) read as an inconsistency once panels were viewed side by side.
- **List row layout**: for rows with per-item action icons/buttons (download, delete, checkboxes — e.g. Lab tests), use `position: relative; display: flex; flex-direction: column;` on the row with padding that reserves space on one side (e.g. `padding: 8px 46px 8px 12px;`), group compact metadata (date, type/status badges) into its own inner flex-wrap container (e.g. `.labtest-info`) so it can wrap onto a second line by itself, and give the actions group `position: absolute; top: 8px; right: 8px;` so they're pinned in a fixed corner, outside the normal wrapping flow — otherwise they get squeezed out or dropped onto their own mostly-empty line when the row's text needs more room (a real, visually-confirmed bug in an earlier iteration of this exact row). For rows with no per-item actions (the whole row is just clickable, e.g. Self-tests/Polar-tests), a simple `display: flex; align-items: center;` row is enough — no need for the pinned-corner treatment.
- **Typography scale inside a row**: dates/timestamps ~`0.8rem`, `font-weight: 600`, `color: var(--muted)` (not full-strength `var(--ink)` — a date is metadata, not the primary content). Small status/type pill badges ~`0.7–0.75rem`, `padding: 1px 6px`, `border-radius: 4px`. The row's main content (name/description) gets no explicit font-size override, so it reads clearly larger/more prominent than its own metadata — don't let the date or a badge end up the same size as, or larger than, the actual content, since nothing in the browser's default styling stops that (an unset `font-size` inherits the page default, which is often *larger* than the small badges next to it — this exact bug hit both the Lab tests and Self-tests/Polar-tests date labels before being fixed 2026-07-15).
- **Date position inside a row**: the date is always the *first* element in the row's metadata line, before any type/status badges (see `.labtest-info`'s child order: date, then type badge, then status badge) — not buried at the end of a details/secondary line. This was missed once on Records (date sat at the end of `.profile-record-details`, after competition/location) because this rule was only implicit in the Lab tests markup and never written down explicitly; write conventions down explicitly rather than leaving them to be inferred from one reference file, since inference is exactly the step that gets skipped under time pressure.
- **Row hover color**: every panel row (Lab tests, Self-tests/Polar-tests, Health journal, Diary) uses `background: var(--panel-row-hover)` on `:hover` — a dedicated CSS variable (`#f7efe2`, a lighter tan than the general-purpose `--surface-hover: #efe6d8` used elsewhere in the app for buttons/dropdowns) added 2026-07-15 specifically so sidebar panel rows get a consistent, lighter hover tone without changing hover color anywhere else in the app. Every row in these four panels should have *some* hover feedback, even rows that aren't clickable (e.g. Diary entries, where only the ✏️/✕ buttons are actionable) — the owner flagged Diary's missing hover as an inconsistency once panels were compared side by side.
- These are visual defaults to reach for unless the user asks for something else for a specific panel — not a mandate to retroactively restyle older panels that already work and haven't been flagged as visually off.

## Conventions

- **UI language is Latvian** — all user-facing strings, labels, day names. Code identifiers and comments are in English.
- Add new Supabase table access as a new function in `db.js`, not inline in `app.js`.
- No localStorage is used for domain data (only for small UI prefs like `calendarMode`, `panelCollapsed`, `rememberLogin`, and "seen/read" ID sets for notification badges) — everything else is Supabase-backed.

## Working carefully in `app.js`

`app.js` has accumulated structural damage from prior low-effort automated edits: duplicate/dead code, half-finished features, inconsistent patterns across similar sections, and state-management bugs (globals drifting out of sync with what's rendered). Given this history, and that the project owner cannot review JS themselves:

- Read the surrounding function fully rather than pattern-matching on a nearby similar-looking function — similar features (e.g. the various `render*Tests` / `renderHealthJournal` / diary sections) do not always follow identical conventions despite looking alike.
- Ask before making a large or sweeping change; prefer small, targeted diffs. Don't "clean up while you're in there" unless asked.
- Commit in small, frequent increments rather than one large commit, so a bad change is easy to spot and revert.
- After editing, actually exercise the affected flow in a browser (open `index.html`, log in as the test account "Testa Sportists" or as coach, click through it) before declaring the task done — there is no test suite to catch regressions. Explain what you tested in plain, non-technical terms.
- **Never commit or push to `main`** — all work happens on `feature` (or another working branch); the user merges to `main` themselves to trigger the Netlify deploy.
- Keep explanations simple and non-technical when talking to the user, and respond in Latvian (per the user's stated preference).

### Splitting `app.js` into smaller files (in progress)

The owner agrees the single ~6100-line `app.js` is itself a source of the recurring damage and wants it split into smaller, focused files (still plain `<script>` tags, no bundler/build step needed) — but has delegated the *how* entirely to Claude, since they can't evaluate JS structure themselves.

**Started 2026-07-14.** Extracted so far: `panels/self-tests.js`, `panels/polar-tests.js`, `panels/health-journal.js`, `panels/lab-tests.js` (2026-07-15), `panels/diary.js` (2026-07-15), `panels/records.js` (2026-07-15). The established, verified recipe for each panel:

1. Identify a panel with its own state variable(s), its own `render*()` function, and its own dialog/save/delete handlers, with minimal cross-references from the rest of `app.js` (check via `grep` before starting).
2. Move that panel's state declarations, "seen/read" tracking helpers, `render*()` function, and dialog/event-listener code into a new `panels/<name>.js` file, verbatim (no behavior changes).
3. Remove the same code from `app.js`. Watch for code that's *physically* interleaved with the panel you're extracting but *logically* belongs to a different panel (this has happened — e.g. a neighboring panel's button listeners sitting in the middle of another panel's block) — leave those in `app.js`.
4. Add the new `<script>` tag to `index.html`, positioned **before** `app.js` (see Architecture note above on why).
5. Bring the panel's markup/CSS in line with the "Sidebar panel visual conventions" section below (add-button class/text/placement, row layout, typography, hover color) as part of the same extraction — don't wait to be asked separately each time; apply it by default whenever a panel is touched, the same way it was retrofitted onto Self-tests/Polar-tests/Health journal/Diary/Records.
6. Verify: `node --check` on every touched `.js` file, grep for duplicate declarations and dangling references to the moved names.
7. Ask the owner to click through the affected feature in the browser before moving to the next panel.

Both previously identified candidates (Diary, Records) are now extracted. Next candidates haven't been scouted yet — look for another panel with its own isolated state var + `render*()` fn + dialog/save/delete handlers and minimal cross-references, the same way Diary/Records were identified, before starting.
