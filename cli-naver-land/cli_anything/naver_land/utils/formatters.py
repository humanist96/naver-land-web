"""Output formatters — table and JSON formatting for Naver Land CLI."""

from __future__ import annotations

import json
from collections import Counter

import click

from cli_anything.naver_land.core.search import NaverListing
from cli_anything.naver_land.core.filter import parse_price


TABLE_HEADERS = ["단지명", "거래", "면적", "분류", "가격", "층", "동"]


def format_table(listings: list[NaverListing], skin=None) -> None:
    """Print listings as a formatted table."""
    if not listings:
        click.echo("  검색 결과가 없습니다.")
        return

    rows = [listing.to_table_row() for listing in listings]

    if skin:
        skin.table(TABLE_HEADERS, rows)
    else:
        _simple_table(TABLE_HEADERS, rows)

    click.echo(f"\n  총 {len(listings)}건")


def _simple_table(headers: list[str], rows: list[list[str]]) -> None:
    """Simple table without ReplSkin (for non-REPL usage)."""
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(col_widths):
                col_widths[i] = max(col_widths[i], _display_width(str(cell)))

    def pad(text: str, width: int) -> str:
        t = str(text)
        diff = width - _display_width(t)
        return t + " " * max(0, diff)

    header_line = " | ".join(pad(h, col_widths[i]) for i, h in enumerate(headers))
    sep_line = "-+-".join("-" * w for w in col_widths)

    click.echo(f"  {header_line}")
    click.echo(f"  {sep_line}")
    for row in rows:
        cells = [pad(str(cell), col_widths[i]) for i, cell in enumerate(row) if i < len(col_widths)]
        click.echo(f"  {' | '.join(cells)}")


def _display_width(s: str) -> int:
    """Calculate display width accounting for wide CJK characters."""
    width = 0
    for ch in s:
        if ord(ch) > 0x1100 and _is_wide(ch):
            width += 2
        else:
            width += 1
    return width


def _is_wide(ch: str) -> bool:
    """Check if character is a wide (CJK) character."""
    cp = ord(ch)
    return (
        (0x1100 <= cp <= 0x115F) or
        (0x2E80 <= cp <= 0x9FFF) or
        (0xAC00 <= cp <= 0xD7AF) or
        (0xF900 <= cp <= 0xFAFF) or
        (0xFE30 <= cp <= 0xFE6F) or
        (0xFF01 <= cp <= 0xFF60) or
        (0xFFE0 <= cp <= 0xFFE6)
    )


def format_json(listings: list[NaverListing]) -> str:
    """Format listings as JSON string."""
    data = [listing.to_dict() for listing in listings]
    return json.dumps(data, indent=2, ensure_ascii=False)


def format_summary(listings: list[NaverListing], district: str = "") -> dict:
    """Generate summary statistics for listings."""
    if not listings:
        return {"total": 0}

    trade_counts = {}
    size_counts = {}
    for listing in listings:
        trade_counts[listing.trad_tp_nm] = trade_counts.get(listing.trad_tp_nm, 0) + 1
        size_counts[listing.size_type] = size_counts.get(listing.size_type, 0) + 1

    # Price statistics
    prices = [parse_price(l.prc) for l in listings if l.prc]
    valid_prices = [p for p in prices if p > 0]

    price_stats = {}
    if valid_prices:
        price_stats = {
            "min": _format_price_kr(min(valid_prices)),
            "max": _format_price_kr(max(valid_prices)),
            "avg": _format_price_kr(sum(valid_prices) // len(valid_prices)),
        }

    return {
        "district": district,
        "total": len(listings),
        "trade_types": trade_counts,
        "size_types": size_counts,
        "price_stats": price_stats,
    }


def format_summary_text(listings: list[NaverListing], district: str = "") -> str:
    """Generate formatted summary text for display."""
    summary = format_summary(listings, district)
    if summary["total"] == 0:
        return "  검색 결과가 없습니다."

    lines = []
    if district:
        lines.append(f"  {district} 검색 결과")
        lines.append("  " + "─" * 30)

    lines.append(f"  총 매물:    {summary['total']}건")

    ps = summary.get("price_stats", {})
    if ps:
        lines.append(f"  가격 범위:  {ps['min']} ~ {ps['max']}")
        lines.append(f"  평균 가격:  {ps['avg']}")

    if summary.get("size_types"):
        parts = [f"{k} {v}건" for k, v in summary["size_types"].items()]
        lines.append(f"  평형 분포:  {' | '.join(parts)}")

    if summary.get("trade_types"):
        parts = [f"{k} {v}건" for k, v in summary["trade_types"].items()]
        lines.append(f"  거래유형:  {' | '.join(parts)}")

    return "\n".join(lines)


def _format_price_kr(price_man: int) -> str:
    """Format price in 만원 to Korean notation (예: 85000 → '8억 5,000')."""
    if price_man <= 0:
        return "0"
    eok = price_man // 10000
    remainder = price_man % 10000
    if eok > 0 and remainder > 0:
        return f"{eok}억 {remainder:,}"
    elif eok > 0:
        return f"{eok}억"
    else:
        return f"{remainder:,}"
