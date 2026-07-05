@echo off
REM ===============================================================
REM  Rushtown Operations Hub — Deploy script
REM  Double-click this file to push changes to GitHub.
REM  Netlify auto-builds the live app from GitHub in ~2 min:
REM  https://rushtownmaintenancehub.netlify.app/
REM ===============================================================

cd /d "%~dp0"

REM === Auto-heal git (OneDrive can leave a stale lock or corrupt the index) ===
REM These settings stop OneDrive's permission/timestamp churn from showing as
REM fake changes, and clear/rebuild git's lock + index if they got corrupted.
REM Your actual files are never touched by this — only git's internal cache.
git config core.fileMode false >nul 2>&1
git config core.trustctime false >nul 2>&1
git config core.checkStat minimal >nul 2>&1
if exist ".git\index.lock" ( echo Clearing stale git lock... & del /f /q ".git\index.lock" )
git status >nul 2>&1
if errorlevel 1 (
  echo Repairing git index ^(OneDrive corruption^) — your files are safe...
  del /f /q ".git\index" >nul 2>&1
  git reset --mixed HEAD >nul 2>&1
)

REM === Auto-heal a stuck merge/rebase conflict (daily-snapshot bot vs local) ===
REM If a previous sync was interrupted, git can be left with "unmerged files"
REM that block every future pull/commit/push. Clear any half-finished rebase or
REM merge, then resolve leftover conflicts to the committed version (the eos
REM snapshot is bot-generated and re-syncs cleanly on the next pull). Your app
REM files are never touched.
if exist ".git\rebase-merge" ( echo Clearing interrupted rebase... & git rebase --abort >nul 2>&1 )
if exist ".git\rebase-apply" ( echo Clearing interrupted rebase... & git rebase --abort >nul 2>&1 )
if exist ".git\MERGE_HEAD"   ( echo Clearing interrupted merge...  & git merge --abort  >nul 2>&1 )
for /f "delims=" %%F in ('git diff --name-only --diff-filter=U 2^>nul') do (
  echo Resolving leftover conflict: %%F
  git checkout HEAD -- "%%F" >nul 2>&1 || git rm -f -- "%%F" >nul 2>&1
  git add -A -- "%%F" >nul 2>&1
)

echo.
echo === Current changes ===
git status --short
echo.

echo === Staging changed files ===
git add -A js/ index.html sw.js DEPLOY.bat netlify.toml firestore.rules functions/index.js firebase.json
git status --short
echo.

set /p MSG="Commit message (press Enter for default): "
if "%MSG%"=="" set MSG=Update Operations Hub (%DATE%)

echo.
echo === Committing ===
git commit -m "%MSG%"
echo.

echo === Syncing with GitHub (pulls bot snapshot commits first) ===
REM The daily-report GitHub Action adds a "daily snapshot" commit to main
REM every day. Without this pull, the push below gets rejected.
git pull --rebase --autostash origin main
if errorlevel 1 (
  echo.
  echo  !!! PULL FAILED — fix the conflict above, then run DEPLOY.bat again.
  echo.
  pause
  exit /b 1
)
echo.

echo === Pushing to GitHub (triggers deploy) ===
git push origin main
if errorlevel 1 (
  echo.
  echo  !!! PUSH FAILED — nothing was deployed. Read the error above.
  echo.
  pause
  exit /b 1
)
echo.

echo === Done ===
echo Push succeeded. The app will rebuild at:
echo     https://rushtownmaintenancehub.netlify.app/
echo in about 2 minutes. Refresh a tablet to pick up the new version.
echo.
pause
