"""One-click setup helper for Rushtown Tier Updater.

Run this from the tier-updater folder:
    python setup_wizard.py

It auto-detects likely OneDrive paths, writes config.json, installs packages,
and can install the Windows scheduled task.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parent
USER_HOME = Path.home()


def find_onedrive_roots() -> list[Path]:
    roots: list[Path] = []
    for key in ("OneDriveCommercial", "OneDrive", "OneDriveConsumer"):
        value = os.environ.get(key)
        if value:
            p = Path(value)
            if p.exists():
                roots.append(p)
    for p in USER_HOME.glob("OneDrive*Rushtown*"):
        if p.exists() and p not in roots:
            roots.append(p)
    for p in USER_HOME.glob("OneDrive*"):
        if p.exists() and p not in roots:
            roots.append(p)
    return roots


def search_folder(name: str) -> Path | None:
    for root in find_onedrive_roots():
        direct = root / name
        if direct.exists():
            return direct
        for candidate in root.rglob(name):
            if candidate.is_dir():
                return candidate
    return None


def ask_path(label: str, detected: Path | None) -> Path:
    print()
    if detected:
        print(f"Detected {label}: {detected}")
        answer = input("Use this path? Press Enter for yes, or paste a different path: ").strip().strip('"')
        return detected if not answer else Path(answer)
    answer = input(f"Paste the full path for {label}: ").strip().strip('"')
    return Path(answer)


def install_requirements() -> None:
    requirements = REPO_DIR / "requirements.txt"
    if not requirements.exists():
        print("requirements.txt not found; skipping package install.")
        return
    print("Installing Python packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(requirements)])


def write_config(tier_folder: Path, reports_folder: Path) -> Path:
    config = {
        "tier_meetings_folder": str(tier_folder).replace("\\", "/"),
        "daily_reports_folder": str(reports_folder).replace("\\", "/"),
        "backup_folder": str((tier_folder / "_Backups")).replace("\\", "/"),
        "log_folder": str((tier_folder / "_Logs")).replace("\\", "/"),
        "tier_1_file": "Tier 1 Daily.xlsx",
        "tier_2_file": "Tier 2 Weekly.xlsx",
        "mapping_file": "mappings/tier_mapping.sample.json",
        "run_time": "06:45",
        "timezone": "America/New_York",
        "fail_on_missing_required_report": False,
    }
    path = REPO_DIR / "config.json"
    path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    print(f"Wrote config: {path}")
    return path


def install_schedule() -> None:
    ps1 = REPO_DIR / "install_task_scheduler.ps1"
    if not ps1.exists():
        print("Task scheduler installer not found; skipping schedule install.")
        return
    answer = input("Install daily Windows scheduled task for 6:45 AM? y/n: ").strip().lower()
    if answer != "y":
        return
    subprocess.check_call([
        "powershell",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(ps1),
        "-ProjectFolder",
        str(REPO_DIR),
        "-RunTime",
        "06:45",
    ])


def main() -> None:
    print("Rushtown Tier Updater setup")
    print("============================")
    tier_folder = ask_path("Tier Meetings folder", search_folder("Tier Meetings"))
    reports_folder = ask_path("Daily Reports folder", search_folder("Daily Reports"))

    if not tier_folder.exists():
        raise SystemExit(f"Tier Meetings folder does not exist: {tier_folder}")
    if not reports_folder.exists():
        print(f"Daily Reports folder does not exist. Creating it: {reports_folder}")
        reports_folder.mkdir(parents=True, exist_ok=True)

    write_config(tier_folder, reports_folder)
    install_requirements()
    install_schedule()

    print()
    print("Setup complete.")
    print("Next test command:")
    print(f"  python {REPO_DIR / 'tier_updater.py'} --config {REPO_DIR / 'config.json'} --date today")


if __name__ == "__main__":
    main()
