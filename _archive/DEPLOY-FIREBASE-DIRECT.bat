@echo off
REM ===============================================================
REM  BACKUP: Deploy directly to Firebase (skips GitHub)
REM  Use this if the regular DEPLOY.bat is having git issues.
REM  Requires Firebase CLI: npm install -g firebase-tools
REM ===============================================================

cd /d "%~dp0"

echo.
echo === Deploying directly to Firebase Hosting ===
echo.
firebase deploy --only hosting
echo.

echo === Done ===
echo Refresh the app and check Maintenance ^> PM Schedule ^> Processing Plant
echo.
pause
