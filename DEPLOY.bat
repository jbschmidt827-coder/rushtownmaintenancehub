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

echo === Pushing to GitHub (triggers Firebase deploy) ===
git push origin main
echo.

echo === Done ===
echo GitHub Actions will deploy in ~2 minutes.
echo Then refresh the app — Processing Plant pill appears under PM Schedule.
echo.
pause
