@echo off
setlocal
cd /d "%~dp0"
echo Running Tier workbook discovery...
python auto_discover.py --config config.json
pause
