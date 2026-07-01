# Rushtown Tier Updater

This automation updates the existing Tier 1 and Tier 2 Excel workbooks in the OneDrive/SharePoint synced **Tier Meetings** folder.

## Goal

Daily reports go into one folder. The updater reads those reports and updates:

- `Tier 1 Daily.xlsx`
- `Tier 2 Weekly.xlsx`

The files stay in the same Tier Meetings folder so OneDrive syncs the updates to the team.

## Setup

1. Install Python 3.11 or newer.
2. Open PowerShell in this folder.
3. Run:

```powershell
pip install -r requirements.txt
copy config.sample.json config.json
notepad config.json
```

4. Edit the paths in `config.json`.
5. Run a test:

```powershell
python tier_updater.py --config config.json --date today
```

## Install daily schedule

After the test works:

```powershell
powershell -ExecutionPolicy Bypass -File install_task_scheduler.ps1 -ProjectFolder "C:\path\to\rushtownmaintenancehub\automation\tier-updater" -RunTime "06:45"
```

## Current status

The engine, backup process, logging, and sample mapping are in place. The next step is verifying the exact source cell to Tier cell mapping from the real Rushtown reports.
