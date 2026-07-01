"""Daily report discovery helper.

Scans a Daily Reports folder and prints the newest matching report for each expected source.
This helps confirm the automation is reading the right daily files before updating Tier boards.

Run:
    python discover_reports.py --folder "C:/path/to/Daily Reports"
"""

from __future__ import annotations

import argparse
from pathlib import Path

REPORT_PATTERNS = {
    "processing_summary": ["*Processing Summary*.xlsx"],
    "mill_tons": ["*Mill*tons*.xlsx", "*tons produced*.xlsx"],
    "hours_by_department": ["Hours_by_department*.xlsx", "Hours by department*.xlsx"],
    "hegins_house_1": ["*Hegins 1*DAILY FARM*RECORDS*.xlsx", "*Hegins House 1*DAILY FARM*.xlsx"],
    "hegins_house_3": ["*Hegins 3*DAILY FARM*RECORDS*.xlsx", "*Hegins House 3*DAILY FARM*.xlsx"],
    "hegins_house_4": ["*Hegins 4*DAILY FARM*RECORDS*.xlsx", "*Hegins House 4*DAILY FARM*.xlsx"],
    "hegins_house_5": ["*Hegins 5*DAILY FARM*RECORDS*.xlsx", "*Hegins House 5*DAILY FARM*.xlsx"],
    "hegins_house_6": ["*Hegins 6*DAILY FARM*RECORDS*.xlsx", "*Hegins House 6*DAILY FARM*.xlsx"],
    "hegins_house_7": ["*Hegins 7*DAILY FARM*RECORDS*.xlsx", "*Hegins House 7*DAILY FARM*.xlsx"],
    "hegins_house_8": ["*Hegins 8*DAILY FARM*RECORDS*.xlsx", "*Hegins House 8*DAILY FARM*.xlsx"],
    "danville_house_1": ["*Danville House 1*DAILY FARM*.xlsx"],
    "danville_house_2": ["*Danville House 2*DAILY FARM*.xlsx"],
    "danville_house_3": ["*Danville House 3*DAILY FARM*.xlsx"],
    "danville_house_4": ["*Danville House 4*DAILY FARM*.xlsx"],
    "danville_house_5": ["*Danville House 5*DAILY FARM*.xlsx"],
}


def newest(folder: Path, patterns: list[str]) -> Path | None:
    matches: list[Path] = []
    for pattern in patterns:
        matches.extend(folder.glob(pattern))
    matches = [p for p in matches if p.is_file() and not p.name.startswith("~$")]
    return max(matches, key=lambda p: p.stat().st_mtime) if matches else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder", required=True, help="Daily Reports folder")
    args = parser.parse_args()

    folder = Path(args.folder)
    print(f"Scanning: {folder}")
    for key, patterns in REPORT_PATTERNS.items():
        match = newest(folder, patterns)
        if match:
            print(f"OK      {key}: {match.name}")
        else:
            print(f"MISSING {key}: {patterns}")


if __name__ == "__main__":
    main()
