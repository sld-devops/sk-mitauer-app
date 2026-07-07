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
- **Always respond in Latvian.**

## Communication style

- **Do not ask complex technical questions** with multiple options (e.g., "Should we use X or Y? Which do you prefer?")
- **Speak in simple language** — explain only the result, not technical syntax terms
- **Trust your judgment** — when user says "I trust you", just do it without asking
- Keep explanations short and focused on what changed visually/functionally
- **Always respond in Latvian.**

## Key constraints from README

> "Coach selects an athlete. Coach chooses a saved training preparation or creates a new training from form fields. Coach clicks a day to place the selected training for that athlete. Coach can add a coach comment. Athlete can add an athlete comment."

## Active Work: Ierobežojumi pa dienas daļām

### Problēma
Šobrīd ierobežojums bloķē visu dienu. Sportists varētu gribēt bloķēt tikai vakaru, bet treneris varētu likt treniņu no rīta.

### Risinājums
1. **DB migrācija** — pievienot `time_of_day` kolonnu `restrictions` tabulai (nullable; `null` = visa diena)
2. **Helper funkcija** `isTimeSlotRestricted(dateStr, tod)` — pārbauda vai konkrēta dienas daļa ir bloķēta:
   - Ja ir ierobežojums bez `time_of_day` → bloķē visas 3 daļas
   - Ja ir ierobežojums ar `time_of_day` → bloķē tikai to daļu
3. **Dienas renderēšana** (`app.js:1943`) — rādīt "Ieplānot" pogu tikai nebloķētām dienas daļām. Ja visas 3 bloķētas → rādīt pilnas dienas ierobežojumu
4. **Klikšķu handleris** (`app.js:4170`) — bloķēt tikai konkrēto `tod`, nevis visu dienu
5. **Mēneša skati** (`app.js:3257, 3340`) — rādīt 🚫 ja ir jebkāds ierobežojums (bez izmaiņām)
6. **Ierobežojuma forma** (`app.js:2325-2332`) — pievienot radio pogas: "Visa diena" (noklusējums), "Rīts", "Pusdiena", "Vakars"

### Esošie ierobežojumi
Netiek migrēti — `time_of_day = null` tiek traktēts kā visa diena.

## Active Work: Mēneša skata izvēršamie teksti

### Problēma
Mēneša skatā ierobežojuma un veselības teksti tiek apgriezti ar `text-overflow: ellipsis`. Pilns teksts nav redzams.

### Risinājums (izdarīts)
- CSS: pievienota `.expanded` klase `.month-restriction-text` un `.month-health-text` elementiem
- HTML: pievienots `role="button"` un `tabindex="0"` abiem elementiem
- JS: pievienots klikšķu handleris, kas pārslēdz `.expanded` klasi — uzspiežot teksts izvēršas
