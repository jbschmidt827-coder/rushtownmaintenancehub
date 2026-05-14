@echo off
REM ====================================================================
REM  Rushtown Operations Hub — FIX STAFF DROPDOWN deploy
REM  ----------------------------------------------------
REM  This commits and pushes ALL pending changes from this folder to
REM  GitHub. GitHub Actions then auto-deploys to Firebase Hosting and
REM  Netlify within ~2 minutes.
REM
REM  Double-click this file to deploy. It will prompt before pushing.
REM ====================================================================

cd /d "%~dp0"

echo.
echo ====================================================================
echo  Rushtown Operations Hub Deploy
echo ====================================================================
echo.

echo === Current changes (files git will commit) ===
git status --short
echo.

pause

echo.
echo === Staging all tracked + new files ===
git add -A
echo.

echo === Files to be committed ===
git status --short
echo.

set MSG=Fix staff dropdown + WO names + roster seeder

echo === Committing with message: "%MSG%" ===
git commit -m "%MSG%"
echo.

echo === Pushing to GitHub (this triggers Netlify + Firebase deploys) ===
git push origin main
echo.

echo ====================================================================
echo  DONE - GitHub Actions deploys to Firebase + Netlify auto-deploys
echo  Wait about 90 seconds, then hard-reload the app (Ctrl+Shift+R).
echo ====================================================================
echo.
pause
