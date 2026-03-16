"""Export utilities — CSV, JSON, Excel export for Naver Land listings."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from cli_anything.naver_land.core.search import NaverListing


LISTING_HEADERS = [
    "매물번호", "단지명", "거래유형", "부동산유형", "동", "전용면적(㎡)", "공급면적(㎡)",
    "평형", "평형분류", "가격", "월세", "층", "확인일", "태그",
]


def _listing_to_row(listing: NaverListing) -> list[str]:
    return [
        listing.atcl_no,
        listing.atcl_nm,
        listing.trad_tp_nm,
        listing.rlet_tp_nm,
        listing.cortarNo,
        str(listing.spc1),
        str(listing.spc2),
        str(listing.pyeong),
        listing.size_type,
        listing.prc,
        listing.rent_prc or "",
        listing.flr_info or "",
        listing.cfm_ymd or "",
        ", ".join(listing.tag_list),
    ]


def export_csv(listings: list[NaverListing], output_path: str) -> dict:
    """Export listings to CSV file."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(LISTING_HEADERS)
        for listing in listings:
            writer.writerow(_listing_to_row(listing))

    return {
        "path": str(path),
        "format": "csv",
        "count": len(listings),
        "size": path.stat().st_size,
    }


def export_json(listings: list[NaverListing], output_path: str) -> dict:
    """Export listings to JSON file."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    data = [listing.to_dict() for listing in listings]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return {
        "path": str(path),
        "format": "json",
        "count": len(listings),
        "size": path.stat().st_size,
    }


def export_excel(listings: list[NaverListing], output_path: str) -> dict:
    """Export listings to Excel file. Requires openpyxl."""
    try:
        from openpyxl import Workbook
    except ImportError:
        raise RuntimeError(
            "Excel 내보내기에는 openpyxl이 필요합니다. "
            "설치: pip install openpyxl"
        )

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    wb = Workbook()
    ws = wb.active
    ws.title = "매물목록"

    ws.append(LISTING_HEADERS)
    for listing in listings:
        ws.append(_listing_to_row(listing))

    wb.save(str(path))

    return {
        "path": str(path),
        "format": "excel",
        "count": len(listings),
        "size": path.stat().st_size,
    }
