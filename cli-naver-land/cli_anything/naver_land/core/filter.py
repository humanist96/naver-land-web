"""Filtering pipeline — price parsing and multi-criteria filtering for NaverListing."""

from __future__ import annotations

import re
from dataclasses import dataclass, replace

from cli_anything.naver_land.core.search import NaverListing


def parse_price(price_str: str) -> int:
    """Parse Korean price string to 만원 (10,000 KRW) units.

    Examples:
        "8억 5,000" → 85000
        "5억" → 50000
        "50000" → 50000
        "1억 2,500" → 12500
        "3,000" → 3000
    """
    s = price_str.strip().replace(",", "")

    # Handle "X억 Y" pattern
    match = re.match(r"(\d+)억\s*(\d*)", s)
    if match:
        eok = int(match.group(1))
        remainder = int(match.group(2)) if match.group(2) else 0
        return eok * 10000 + remainder

    # Plain number
    try:
        return int(s)
    except ValueError:
        return 0


def parse_floor_filter(floor_str: str) -> tuple[int | None, int | None]:
    """Parse floor filter string.

    Examples:
        "10+" → (10, None)
        "3-10" → (3, 10)
        "5" → (5, 5)
    """
    s = floor_str.strip()
    if s.endswith("+"):
        return (int(s[:-1]), None)
    if "-" in s:
        parts = s.split("-", 1)
        return (int(parts[0]), int(parts[1]))
    return (int(s), int(s))


def extract_floor(flr_info: str | None) -> int | None:
    """Extract numeric floor from floor info string like '10/25'."""
    if not flr_info:
        return None
    match = re.match(r"(\d+)", flr_info)
    if match:
        return int(match.group(1))
    return None


@dataclass(frozen=True)
class FilterCriteria:
    size_type: str | None = None
    min_area: float | None = None
    max_area: float | None = None
    min_price: str | None = None
    max_price: str | None = None
    floor: str | None = None
    since_date: str | None = None
    until_date: str | None = None
    tags: list[str] | None = None
    name_contains: str | None = None
    min_rent: str | None = None
    max_rent: str | None = None

    @property
    def is_empty(self) -> bool:
        return all(
            v is None
            for v in (self.size_type, self.min_area, self.max_area,
                      self.min_price, self.max_price, self.floor,
                      self.since_date, self.until_date, self.tags,
                      self.name_contains, self.min_rent, self.max_rent)
        )

    def to_dict(self) -> dict:
        result = {}
        if self.size_type:
            result["size_type"] = self.size_type
        if self.min_area is not None:
            result["min_area"] = self.min_area
        if self.max_area is not None:
            result["max_area"] = self.max_area
        if self.min_price:
            result["min_price"] = self.min_price
        if self.max_price:
            result["max_price"] = self.max_price
        if self.floor:
            result["floor"] = self.floor
        if self.since_date:
            result["since_date"] = self.since_date
        if self.until_date:
            result["until_date"] = self.until_date
        if self.tags:
            result["tags"] = self.tags
        if self.name_contains:
            result["name_contains"] = self.name_contains
        if self.min_rent:
            result["min_rent"] = self.min_rent
        if self.max_rent:
            result["max_rent"] = self.max_rent
        return result


def apply_filters(listings: list[NaverListing], criteria: FilterCriteria) -> list[NaverListing]:
    """Apply filter criteria to a list of listings."""
    if criteria.is_empty:
        return listings

    result = list(listings)

    if criteria.size_type:
        result = [l for l in result if l.size_type == criteria.size_type]

    if criteria.min_area is not None:
        result = [l for l in result if l.spc1 >= criteria.min_area]

    if criteria.max_area is not None:
        result = [l for l in result if l.spc1 <= criteria.max_area]

    if criteria.min_price:
        min_val = parse_price(criteria.min_price)
        result = [l for l in result if parse_price(l.prc) >= min_val]

    if criteria.max_price:
        max_val = parse_price(criteria.max_price)
        result = [l for l in result if parse_price(l.prc) <= max_val]

    if criteria.floor:
        floor_min, floor_max = parse_floor_filter(criteria.floor)
        filtered = []
        for listing in result:
            flr = extract_floor(listing.flr_info)
            if flr is None:
                continue
            if floor_min is not None and flr < floor_min:
                continue
            if floor_max is not None and flr > floor_max:
                continue
            filtered.append(listing)
        result = filtered

    if criteria.since_date:
        result = [l for l in result
                  if l.cfm_ymd and l.cfm_ymd.replace(".", "") >= criteria.since_date.replace("-", "")]

    if criteria.until_date:
        result = [l for l in result
                  if l.cfm_ymd and l.cfm_ymd.replace(".", "") <= criteria.until_date.replace("-", "")]

    if criteria.tags:
        result = [l for l in result
                  if any(tag in l.tag_list for tag in criteria.tags)]

    if criteria.name_contains:
        result = [l for l in result
                  if criteria.name_contains in l.atcl_nm]

    if criteria.min_rent:
        min_rent_val = parse_price(criteria.min_rent)
        result = [l for l in result
                  if l.rent_prc and parse_price(l.rent_prc) >= min_rent_val]

    if criteria.max_rent:
        max_rent_val = parse_price(criteria.max_rent)
        result = [l for l in result
                  if l.rent_prc and parse_price(l.rent_prc) <= max_rent_val]

    return result
