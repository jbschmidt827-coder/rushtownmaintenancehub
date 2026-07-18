@echo off
cd /d "%~dp0"
echo ==================================================
echo   Deploying Cloud Functions (phone alerts)
echo   - Alert when a house check is completed
echo   - Alert when mortality tops 30 in a house
echo ==================================================
echo.
echo === Step 1 of 2: installing dependencies (first time takes a minute) ===
pushd "%~dp0functions"
call npm install
popd
echo.
echo === Step 2 of 2: deploying the alert function to Firebase ===
echo    (deploying ONLY notifyBarnCheck — skips the AI rooster-chat
echo     function that needs the Secret Manager service turned on)
call firebase deploy --only functions:notifyBarnCheck
set RC=%errorlevel%
echo.
if not "%RC%"=="0" (
  echo --------------------------------------------------
  echo  It did not finish.
  echo  - If it said you are NOT logged in, type:  firebase login
  echo    sign in with Google, then double-click this file again.
  echo  - If npm was "not recognized", Node.js needs installing
  echo    ^(tell Claude and it will walk you through it^).
  echo --------------------------------------------------
) else (
  echo === Done - phone alerts are now live ===
)
echo.
pause
