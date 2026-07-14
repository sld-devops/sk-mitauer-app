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

Four flat files, loaded in this order from `index.html`:

1. **`auth.js`** — Supabase client init, login/logout, password change. Defines `currentUser`, `currentProfile`, `isCoach()`, `showApp()`/`showAuth()`.
2. **`db.js`** — all Supabase queries (one thin async function per table operation, e.g. `getPlans`, `insertPlan`, `updateRestriction`). This is the only file that talks to `supabase.from(...)` — treat it as the data-access layer and add new queries here rather than inlining `supabase.from()` calls in `app.js`.
3. **`app.js`** (~6100 lines) — everything else: global mutable state (`let athletes = []`, `plans`, `templates`, `restrictions`, `weeklyTrend`, etc. declared at the top), all rendering (`render*` functions that rebuild DOM from state), and all event wiring. No components, no virtual DOM — state mutation is followed by manually calling the relevant `render*()` function.
4. **`styles.css`** — all styles, using CSS custom properties for the design system.

`index.html` is the entrypoint: static DOM shell for both the `#authView` and `#appView` (all panels/sections/dialogs are pre-declared in HTML and toggled via `hidden`), plus the `<script>` tags loading the Supabase JS SDK, then `auth.js`, `db.js`, `app.js` in order.

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

### Planned: splitting `app.js` into smaller files

The owner agrees the single 6100-line `app.js` is itself a source of the recurring damage and wants it split into smaller, focused files (still plain `<script>` tags, no bundler/build step needed) — but has delegated the *how* entirely to Claude, since they can't evaluate JS structure themselves. This hasn't started yet. When undertaking it:
- Do it incrementally (one panel/feature area at a time), not as one giant rewrite.
- Verify the existing app still works fully after each step before moving to the next panel — the owner is trusting this verification since they can't check it themselves.
- Explain progress in plain terms after each step (e.g. "moved the training-log section into its own file, tested that logging still works, nothing changed for you").
