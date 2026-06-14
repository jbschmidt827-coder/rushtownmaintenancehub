@echo off
setlocal EnableExtensions
REM ===============================================================
REM  Merge the claude/* feature branch into main and push.
REM  GitHub Actions then deploys to Firebase.
REM ===============================================================

cd /d "%~dp0"

echo.
echo This script will:
echo   1^) Switch to the 'main' branch
echo   2^) Pull the latest 'main' from GitHub
echo   3^) Merge your 'claude/lubing-rebuild-script' branch into 'main'
echo   4^) Push 'main' to GitHub ^(triggers Firebase deploy^)
echo.
pause

echo.
echo === Step 1/4: Switching to main ===
git checkout main
if errorlevel 1 (
  echo.
  echo Could not switch to main — there might be uncommitted changes.
  echo Try opening GitHub Desktop, switching to 'main' there first, then re-run this script.
  pause
  exit /b 1
)
echo.

echo === Step 2/4: Pulling latest main ===
git pull origin main
echo.

echo === Step 3/4: Merging claude/lubing-rebuild-script into main ===
git merge claude/lubing-rebuild-script --no-edit -m "Merge PP/PM trim, checkbox color, deploy script (claude/lubing-rebuild-script)"
if errorlevel 1 (
  echo.
  echo MERGE CONFLICT — needs manual resolution.
  echo Open GitHub Desktop and resolve the conflicts, then commit + push from there.
  pause
  exit /b 1
)
echo.

echo === Step 4/4: Pushing main to GitHub ===
git push origin main
echo.

echo === Done ===
echo GitHub Actions will deploy in ~2 minutes.
echo Then hard-refresh the app ^(Ctrl+F5^) to see the changes.
echo.
pause
endlocal
