@echo off
REM =====================================================================
REM  CLEANUP-DUPLICATE-REPO.bat        Rushtown Ops Hub — 2026-08-06
REM
REM  WHY: there are TWO clones of the app repo on this PC.
REM    KEEP  ->  C:\Users\Joe Schmidt\RushtownApp            (the real one:
REM              DEPLOY.bat / FORCE-PUSH.bat run here, all work happens here)
REM    RETIRE->  ...\OneDrive - Rushtown Poultry\Documents\GitHub\rushtownmaintenancehub
REM              (GitHub Desktop was watching this stale copy — it is inside
REM               OneDrive, which corrupts .git, and pushing from it could
REM               REVERT live work.)
REM
REM  WHAT THIS DOES: checks the old copy for anything unsaved or unpushed.
REM    - Something found  -> STOPS and tells you. Nothing is touched.
REM    - Nothing found    -> RENAMES it to _ARCHIVE_... so it can never be
REM                          pushed from again. NOTHING IS DELETED.
REM =====================================================================
setlocal
set "KEEP=C:\Users\Joe Schmidt\RushtownApp"
set "OLD=C:\Users\Joe Schmidt\OneDrive - Rushtown Poultry\Documents\GitHub\rushtownmaintenancehub"
set "PARENT=C:\Users\Joe Schmidt\OneDrive - Rushtown Poultry\Documents\GitHub"

echo.
echo ==========================================================
echo   DUPLICATE REPO CLEANUP
echo ==========================================================
echo.
echo   KEEPING : %KEEP%
echo   RETIRING: %OLD%
echo.
echo   Close GitHub Desktop before continuing (it holds these files open).
echo.
pause

if not exist "%OLD%\.git" (
  echo   Old copy not found at that path - nothing to do. Maybe already cleaned up.
  echo.
  pause
  exit /b 0
)

echo.
echo --- Checking the old copy for unsaved work ---
for /f "delims=" %%A in ('git -C "%OLD%" status --porcelain 2^>nul') do set "DIRTY=1"
if defined DIRTY (
  echo.
  echo   *** STOP - the old copy has UNCOMMITTED changes: ***
  git -C "%OLD%" status --short
  echo.
  echo   Nothing was moved. Send Claude this list before going further.
  echo.
  pause
  exit /b 1
)
echo   OK - no uncommitted changes.

echo.
echo --- Checking the old copy for unpushed commits ---
git -C "%OLD%" fetch origin 2>nul
for /f %%B in ('git -C "%OLD%" rev-list --count origin/main..HEAD 2^>nul') do set "AHEAD=%%B"
if not defined AHEAD set "AHEAD=0"
if not "%AHEAD%"=="0" (
  echo.
  echo   *** STOP - the old copy has %AHEAD% commit^(s^) NOT on GitHub: ***
  git -C "%OLD%" log --oneline origin/main..HEAD
  echo.
  echo   Nothing was moved. Send Claude this list before going further.
  echo.
  pause
  exit /b 1
)
echo   OK - nothing unpushed.

echo.
echo --- Confirming the good copy is current ---
git -C "%KEEP%" log -1 --oneline
echo.

set "STAMP=%DATE:~-4%%DATE:~4,2%%DATE:~7,2%"
set "DEST=%PARENT%\_ARCHIVE_rushtownmaintenancehub_%STAMP%_DO_NOT_USE"
echo --- Archiving the old copy ---
echo   to: %DEST%
move "%OLD%" "%DEST%" >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Could not move it. Usually means GitHub Desktop or VS Code still has
  echo   the folder open. Close them and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo   DONE - old copy archived, nothing deleted.
echo ==========================================================
echo.
echo   TWO CLICKS LEFT IN GITHUB DESKTOP (I cannot click for you):
echo.
echo     1. File -^> Add local repository -^> %KEEP%
echo     2. Right-click the old "rushtownmaintenancehub" in the repo list
echo        -^> Remove  (it will show as missing now)
echo.
echo   After that, GitHub Desktop and DEPLOY.bat point at the SAME folder,
echo   so "no unpushed commits" will finally mean what it says.
echo.
echo   Once you are happy, you can delete this archive folder yourself:
echo     %DEST%
echo.
pause
endlocal
