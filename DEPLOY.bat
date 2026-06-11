@echo off
REM ===============================================================
REM  Rushtown Operations Hub — Deploy script
REM  Double-click this file to push changes to GitHub.
REM  GitHub Actions will auto-deploy to Firebase Hosting in ~2 min.
REM ===============================================================

cd /d "%~dp0"

echo.
echo === Current changes ===
git status --short
echo.

echo === Staging changed files ===
git add -A js/ index.html sw.js DEPLOY.bat DEPLOY-FIREBASE-DIRECT.bat firestore.rules functions/index.js firebase.json
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
echo Push succeeded. Netlify + Firebase will deploy in ~2 minutes.
echo Then refresh the app on a tablet to pick up the new version.
echo.
pause
