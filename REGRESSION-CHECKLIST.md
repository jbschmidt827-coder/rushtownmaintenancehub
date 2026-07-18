# Rushtown Ops Hub — Pre-Deploy Regression Checklist

Run this list EVERY time before DEPLOY.bat. These are the bug classes that have
actually bitten us more than once. Check the box or don't ship.

## 1. Dead buttons (PWA alert/confirm no-op)
- [ ] No NEW `alert()` used as a blocking guard in crew-facing forms.
      (core.js v197 globally overrides alert→toast, so old ones are visible,
      but new validation should use `toast()` + scroll-to-field directly.)
- [ ] No `window.confirm()` ANYWHERE in a crew daily flow (barn check, morning
      walk, manure, PM, WO, daily checklist). confirm() silently returns false
      in the installed PWA → the button "does nothing". (v191/v194 lesson.)
- [ ] js/selftest.js is loaded and passes: open the app with `?selftest=1` —
      no red banner. It verifies every button's onclick resolves to a real fn.

## 2. Boot crash (duplicate top-level declarations)
- [ ] Every NEW top-level `var/let/const/function` name is unique across ALL
      js files (one global scope — a dup kills the whole file silently).
      Check: grep the new names across js/ before shipping.
- [ ] i18n helpers: never redeclare ML / compL / tdL / procL etc. in a new file.

## 3. Modal / overlay rules
- [ ] NEVER set inline `style.display='none'` on a class-based `.overlay`
      modal — it overrides `.overlay.open` and the modal can never reopen
      (v190 lesson). Close with `classList.remove('open')` + clear inline display.
- [ ] Full-screen id-based overlays (manure-overlay etc.) keep their own
      open/close pair consistent (display block/none is fine there).

## 4. Submit gates (the "employees used it and it didn't save" class)
- [ ] NO arm-and-return / two-tap gates on crew Submit buttons. First tap
      ALWAYS saves; partial saves are fine (v194 lesson).
- [ ] Every save shows a visible `toast()` confirmation.
- [ ] Name-autofill fires only at submit time, never on keystroke (v187/v194).

## 5. Deploy trio (stale-cache class)
- [ ] js/core.js `APP_VERSION` bumped.
- [ ] sw.js `CACHE_NAME` bumped (rushtown-vNNN-slug).
- [ ] index.html `?v=` cache-buster bumped on EVERY edited js file.
- [ ] Deploy from the user's machine via DEPLOY.bat only (never git in the
      sandbox). Cloud Functions deploy separately: `firebase deploy --only functions`.

## 6. Firestore data rules
- [ ] New collections work under the wildcard rules (request.auth != null) —
      no rules change needed, but confirm anonymous auth is still the model.
- [ ] Every record gets a `ts` (ms) field — all history views query
      `where('ts','>=',cutoff).orderBy('ts','desc')` (same field = no
      composite index needed; where+orderBy on DIFFERENT fields will throw).
- [ ] Every record gets `farm`, `house`, `date` (LDATE local YYYY-MM-DD) so
      Today panel / Completion / logs can join on farm|house|date.

## 7. PM tracker
- [ ] Any new PM's `sys` value IS in FACILITY_SYSTEMS[facility] — otherwise
      ALL_PM silently drops it (v120 lesson).
- [ ] Auto-completion bridges (e.g. manure → daily PMs) dedupe per farm+period.

## 8. Home screen / boot
- [ ] initApp() path untouched, or inline boot safety net in index.html still
      present (force-hides splash + surfaces errors at 6s).
- [ ] Home sweep does not inline-hide class-based `.overlay` modals (see #3).
- [ ] Per-area access (v199 js/access.js) still fail-open; new pages added to
      an area's allowlist if crews need them.

## 9. Bilingual / i18n
- [ ] Every new UI string ships EN + ES through the module's ML/tdL/compL helper.
- [ ] Before ADDING a data-i18n key to the core.js dicts, grep for it first —
      a duplicate key silently wins (last-one-wins in object literals) and the
      card/label shows the OLD text (v202 lesson: landing.pkg was already
      'Packaging' from an old card and shadowed the new 'Processing').

## 10. Verification environment
- [ ] The sandbox bash mount serves TRUNCATED/stale copies of large files —
      `node --check` false-fails at the cut point. Verify edited regions with
      host Read/Grep tools; don't trust sandbox wc/node on this repo.

---
Update this file whenever a new repeat-class bug is found. It lives in the
repo on purpose — it ships with the code and survives memory loss.
