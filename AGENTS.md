# SK Mitauer Training Planner — Agent instructions

**What this is:** Vanilla HTML/CSS/JS prototype for `app.skmitauer.com`. No build step, no tests, no backend.

## Commands

```bash
# run locally
xdg-open index.html
```

That is the only command. There is no package.json, no npm, no test runner, no linter, no formatter, no typechecker, no CI.

## Architecture

- `index.html` — entrypoint. Loads `styles.css` and `app.js`.
- `app.js` — all logic (427 lines). Pure DOM manipulation, no framework.
- `styles.css` — all styles (414 lines). Custom properties for the design system.
- UI language: **Latvian** (day names, labels, comments).
- All data lives in-memory (`plans[]`, `templates[]`, `athletes[]`). No persistence yet.
- No localStorage, no service worker, no URL routing.

## Conventions

- No package manager or dependency file — the repo is intentionally bare.
- Comments in code are in English; UI strings are in Latvian.
- Editing convention: maintain the flat-file style. No component extraction, no module bundler.
- Always be concise. Use plain language only. Skip code snippets unless explicitly requested. Ask specific questions when clarification is needed.

## Key constraints from README

> "Coach selects an athlete. Coach chooses a saved training preparation or creates a new training from form fields. Coach clicks a day to place the selected training for that athlete. Coach can add a coach comment. Athlete can add an athlete comment."
