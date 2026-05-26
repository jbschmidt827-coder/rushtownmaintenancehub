# scripts/

One-shot operational scripts you paste into the browser console while signed
in to the Maintenance Hub. They use the page's existing `db` (Firestore) and
helpers (`mintWoId`, `renderWO`, …), so writes go through your auth session.

## Available scripts

### `add-lubing-rebuild-wos.js`

Creates 9 weekly **Lubing rebuild** Work Orders — Barn 1-5 and Hallway 1-4 —
one per week starting Mon 2026-06-29.

**Run it:**
1. Open the Maintenance Hub in your browser and sign in.
2. Press `F12` to open DevTools and switch to the **Console** tab.
3. Open `scripts/add-lubing-rebuild-wos.js`, copy the whole file, paste it
   into the console, and press Enter.
4. The console will print each WO as it's created; the dashboard refreshes
   automatically.

**Tweak before running** (top of the file):

| Constant      | What it controls                                  |
|---------------|---------------------------------------------------|
| `FARM`        | Farm name (default `'Rushtown'`)                  |
| `PRIORITY`    | `'urgent' \| 'high' \| 'normal' \| 'low'`         |
| `TECH`        | Submitting tech name (must match Staff list)      |
| `ASSIGNED_TO` | Who the WO is assigned to                         |
| `START_DATE`  | First scheduled Monday (`YYYY-MM-DD`)             |
| `EST_HOURS`   | Estimated labor hours per WO                      |

The script mirrors `submitWO()` in `js/maintenance.js`: it allocates unique
WO numbers via `mintWoId()`, writes the same field set, and best-effort logs
each creation to `activityLog`.
