@echo off
cd /d "%~dp0"
echo ==================================================
echo   FORCE PUSH - send ALL current files to GitHub
echo   (use when DEPLOY.bat says "nothing to commit"
echo    but the tablets are still on an old version)
echo ==================================================
echo.
echo Local version in this folder:
findstr /C:"APP_VERSION" js\core.js
findstr /C:"CACHE_NAME" sw.js
echo.
echo === Step 0: clear any stale git lock (the thing that jammed it) ===
if exist ".git\index.lock" del /f /q ".git\index.lock" & echo   removed stale index.lock
echo.
echo === Step 1: refresh git's view of every file ===
git add -A
echo.
echo === Step 2: what git now sees as changed ===
git status --short
echo.
echo === Step 3: commit ===
git commit -m "force sync latest app version"
echo.
echo === Step 4: push to GitHub (triggers Netlify build) ===
git push origin main
set RC=%errorlevel%
echo.
echo ==================================================
if not "%RC%"=="0" (
  echo  Push did NOT succeed. Copy this WHOLE window and
  echo  send it to Claude so we can see what git said.
) else (
  echo  Push done. Wait ~2 min, then FULLY close and reopen
  echo  a tablet - the footer should show the new version.
  echo  If it still says "Everything up-to-date" above and the
  echo  version did not change, copy this window to Claude.
)
echo ==================================================
echo.
pause
