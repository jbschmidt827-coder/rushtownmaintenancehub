@echo off
setlocal
cd /d "%~dp0"
echo Starting Rushtown Tier Updater setup...
echo.
python setup_wizard.py
if errorlevel 1 (
  echo.
  echo Setup failed. Copy the error and send it to ChatGPT.
  pause
  exit /b 1
)
echo.
echo Setup finished.
pause
