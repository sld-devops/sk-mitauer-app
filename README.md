# SK Mitauer Training Planner

Small prototype for `app.skmitauer.com`.

## Current focus

The app is intentionally simple:

- Coach selects an athlete.
- Coach chooses a saved training preparation or creates a new training from form fields.
- Coach clicks a day to place the selected training for that athlete.
- Coach can add a coach comment.
- Athlete can add an athlete comment.

The new training builder uses a dropdown only for training type. Repeat count, interval length, interval pace, and rest are shown only for interval training. Tempo runs use the main-part field instead. Free text is still only used for comments.

## Run locally

Open `index.html` in a browser.

From the app folder:

```bash
xdg-open index.html
```

## Next small steps

- Tune dropdown values to match the coach's real training language.
- Saving a new training into preparations is available in the popup.
- Add real dates instead of only weekdays.
- Save data in browser local storage.
- Later: add Supabase login and database for `app.skmitauer.com`.
