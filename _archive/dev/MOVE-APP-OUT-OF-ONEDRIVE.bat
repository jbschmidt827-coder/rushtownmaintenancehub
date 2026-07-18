@echo off
setlocal EnableExtensions
REM ============================================================================
REM  Move the app's working copy OUT of OneDrive (one-time setup).
REM  OneDrive keeps corrupting git inside this folder, which is what causes the
REM  "locked" / "index corrupt" / failed-deploy problems.
REM
REM  This makes a CLEAN copy straight from GitHub into a normal folder.
REM  Your live website (Netlify) and your data (Firebase) are NOT touched.
REM ============================================================================

set "REPO=https://github.com/jbschmidt827-coder/rushtownmaintenancehub.git"
set "TARGET=%USERPROFILE%\RushtownApp"

echo.
echo ============================================================
echo  Setting up a clean, OneDrive-free copy of the app at:
echo     %TARGET%
echo.
echo  - Your live site and data are NOT affected.
echo  - After this, you deploy from the NEW folder's DEPLOY.bat.
echo ============================================================
echo.
pause

REM --- Make sure git is installed ---
where git >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Git was not found. Open GitHub Desktop once ^(it installs git^), then re-run this.
  echo.
  pause
  exit /b 1
)

REM --- Don't clobber an existing copy ---
if exist "%TARGET%\.git" (
  echo.
  echo  A copy already exists at %TARGET%.
  echo  Just use the DEPLOY.bat inside that folder from now on.
  echo.
  start "" explorer "%TARGET%"
  pause
  exit /b 0
)

echo === Downloading a clean copy from GitHub ===
git clone "%REPO%" "%TARGET%"
if errorlevel 1 (
  echo.
  echo  Download failed - read the message above.
  echo  If it asks you to sign in to GitHub, do that and run this again.
  echo.
  pause
  exit /b 1
)

cd /d "%TARGET%"

echo.
echo === Applying OneDrive-proof git settings ===
git config core.fileMode false
git config core.trustctime false
git config core.checkStat minimal

echo.
echo ============================================================
echo  DONE.
echo.
echo  Your clean working copy is here:
echo     %TARGET%
echo.
echo  FROM NOW ON: deploy by double-clicking DEPLOY.bat inside
echo  that folder. Do NOT use the old OneDrive copy to deploy.
echo.
echo  Once you've done one successful deploy from the new folder,
echo  you can delete the old OneDrive copy if you want.
echo ============================================================
echo.
echo Opening the new folder for you...
start "" explorer "%TARGET%"
pause
endlocal
