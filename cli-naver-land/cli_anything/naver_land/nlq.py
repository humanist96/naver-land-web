"""Natural Language Query Parser for Naver Land CLI.

Parses Korean natural language queries into structured search parameters.

Examples:
    "강남 30평대 매매 10억 이하" → district=강남구, size=30평대, trade=매매, max_price=10억
    "부산 해운대 전세 84㎡ 이상" → city=부산시, district=해운대구, trade=전세, min_area=84
    "서초구 반포자이 매매 제일 싼거" → district=서초구, complex=반포자이, trade=매매, sort=prc
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from cli_anything.naver_land.core.districts import (
    find_city,
    find_district,
    find_all_matching_districts,
    CITIES,
    CITY_BY_NAME,
    load_districts,
)
from cli_anything.naver_land.core.filter import FilterCriteria


# ── Keyword maps ──────────────────────────────────────────────

TRADE_KEYWORDS: dict[str, str] = {
    "매매": "매매",
    "사다": "매매",
    "살": "매매",
    "구매": "매매",
    "분양": "매매",
    "전세": "전세",
    "월세": "월세",
    "임대": "월세",
    "단기임대": "단기임대",
    "단기": "단기임대",
}

SIZE_KEYWORDS: dict[str, str] = {
    "소형": "소형",
    "20평": "20평대",
    "20평대": "20평대",
    "30평": "30평대",
    "30평대": "30평대",
    "대형": "중대형",
    "중대형": "중대형",
    "40평": "중대형",
    "50평": "중대형",
}

SORT_KEYWORDS: dict[str, str] = {
    "싼": "prc",
    "저렴": "prc",
    "싼거": "prc",
    "저렴한": "prc",
    "최저가": "prc",
    "가격순": "prc",
    "최신": "date",
    "새로운": "date",
    "최근": "date",
    "넓은": "spc",
    "큰": "spc",
    "면적순": "spc",
}

EXPORT_KEYWORDS: dict[str, str] = {
    "csv": "csv",
    "json": "json",
    "excel": "excel",
    "엑셀": "excel",
    "저장": "csv",
    "다운": "csv",
    "다운로드": "csv",
    "내보내기": "csv",
    "내보내": "csv",
}

# Price patterns
PRICE_PATTERN = re.compile(r"(\d+)\s*억\s*(\d[\d,]*)?만?")
PRICE_SIMPLE = re.compile(r"(\d[\d,]+)\s*만")
PRICE_EOK_ONLY = re.compile(r"(\d+)\s*억")

# Area patterns
AREA_SQM = re.compile(r"(\d+\.?\d*)\s*(?:㎡|제곱미터|평방미터)")
AREA_PYEONG = re.compile(r"(\d+\.?\d*)\s*평(?!대|형)")

# Floor pattern
FLOOR_PATTERN = re.compile(r"(\d+)\s*층\s*(이상|이하|이내|위)")

# City name keywords for quick detection
_CITY_SHORT_NAMES = set()
for _name in CITY_BY_NAME:
    _CITY_SHORT_NAMES.add(_name)


@dataclass
class ParsedQuery:
    """Structured result of parsing a natural language query."""
    city_name: str | None = None
    district_name: str | None = None
    complex_name: str | None = None
    trade_types: list[str] = field(default_factory=list)
    property_type: str = "APT:JGC"
    size_type: str | None = None
    min_area: float | None = None
    max_area: float | None = None
    min_price: str | None = None
    max_price: str | None = None
    floor: str | None = None
    sort: str = "rank"
    limit: int = 1000
    export_format: str | None = None
    export_path: str | None = None

    def to_filter_criteria(self) -> FilterCriteria:
        """Convert to FilterCriteria for apply_filters()."""
        return FilterCriteria(
            size_type=self.size_type,
            min_area=self.min_area,
            max_area=self.max_area,
            min_price=self.min_price,
            max_price=self.max_price,
            floor=self.floor,
            name_contains=self.complex_name,
        )


def parse_natural_query(text: str) -> ParsedQuery:
    """Parse a Korean natural language query into structured parameters.

    Args:
        text: Natural language query string.

    Returns:
        ParsedQuery with extracted search parameters.
    """
    query = ParsedQuery()
    remaining = text.strip()

    # 1. Extract price constraints (before other parsing to avoid conflicts)
    remaining = _extract_prices(remaining, query)

    # 2. Extract area constraints
    remaining = _extract_area(remaining, query)

    # 3. Extract floor constraints
    remaining = _extract_floor(remaining, query)

    # 4. Extract trade types
    remaining = _extract_trade_types(remaining, query)

    # 5. Extract size type
    remaining = _extract_size_type(remaining, query)

    # 6. Extract sort preference
    remaining = _extract_sort(remaining, query)

    # 7. Extract export intent
    remaining = _extract_export(remaining, query)

    # 8. Extract city and district (most complex — do last)
    _extract_location(remaining, query)

    return query


def _extract_prices(text: str, query: ParsedQuery) -> str:
    """Extract price constraints from text."""
    # "10억 이하", "5억 이상"
    m = re.search(r"(\d+억\s*[\d,]*만?)\s*(이하|이내|미만|까지)", text)
    if m:
        query.max_price = m.group(1).replace(" ", "")
        text = text[:m.start()] + text[m.end():]

    m = re.search(r"(\d+억\s*[\d,]*만?)\s*(이상|부터|초과)", text)
    if m:
        query.min_price = m.group(1).replace(" ", "")
        text = text[:m.start()] + text[m.end():]

    # "5억~15억", "5억-15억"
    m = re.search(r"(\d+억\s*[\d,]*만?)\s*[~\-]\s*(\d+억\s*[\d,]*만?)", text)
    if m:
        query.min_price = m.group(1).replace(" ", "")
        query.max_price = m.group(2).replace(" ", "")
        text = text[:m.start()] + text[m.end():]

    # Plain number: "50000 이하" (만원)
    m = re.search(r"(\d[\d,]+)\s*만?\s*(이하|이내|미만|까지)", text)
    if m and not query.max_price:
        query.max_price = m.group(1).replace(",", "") + "만"
        text = text[:m.start()] + text[m.end():]

    return text


def _extract_area(text: str, query: ParsedQuery) -> str:
    """Extract area constraints from text."""
    # "84㎡ 이상"
    m = re.search(r"(\d+\.?\d*)\s*(?:㎡|제곱미터)\s*(이상|이하)", text)
    if m:
        val = float(m.group(1))
        if m.group(2) in ("이상",):
            query.min_area = val
        else:
            query.max_area = val
        text = text[:m.start()] + text[m.end():]

    # "30평 이상" (convert to sqm)
    m = re.search(r"(\d+\.?\d*)\s*평\s*(이상|이하)", text)
    if m:
        val = float(m.group(1)) * 3.3058
        if m.group(2) in ("이상",):
            query.min_area = round(val, 1)
        else:
            query.max_area = round(val, 1)
        text = text[:m.start()] + text[m.end():]

    return text


def _extract_floor(text: str, query: ParsedQuery) -> str:
    """Extract floor constraints from text."""
    m = FLOOR_PATTERN.search(text)
    if m:
        floor_num = m.group(1)
        direction = m.group(2)
        if direction in ("이상", "위"):
            query.floor = f"{floor_num}+"
        elif direction in ("이하", "이내"):
            query.floor = f"1-{floor_num}"
        text = text[:m.start()] + text[m.end():]
    return text


def _extract_trade_types(text: str, query: ParsedQuery) -> str:
    """Extract trade type keywords from text."""
    for keyword, trade_type in TRADE_KEYWORDS.items():
        if keyword in text:
            if trade_type not in query.trade_types:
                query.trade_types.append(trade_type)
            text = text.replace(keyword, "", 1)
    return text


def _extract_size_type(text: str, query: ParsedQuery) -> str:
    """Extract size type keywords from text."""
    for keyword, size_type in SIZE_KEYWORDS.items():
        if keyword in text:
            query.size_type = size_type
            text = text.replace(keyword, "", 1)
            break
    return text


def _extract_sort(text: str, query: ParsedQuery) -> str:
    """Extract sort preference from text."""
    for keyword, sort_key in SORT_KEYWORDS.items():
        if keyword in text:
            query.sort = sort_key
            text = text.replace(keyword, "", 1)
            break
    # "제일 싼" pattern
    if "제일" in text:
        text = text.replace("제일", "", 1)
    return text


def _extract_export(text: str, query: ParsedQuery) -> str:
    """Extract export intent from text."""
    for keyword, fmt in EXPORT_KEYWORDS.items():
        if keyword in text:
            query.export_format = fmt
            text = text.replace(keyword, "", 1)
            break

    # Extract filename if present (e.g., "강남구.csv")
    m = re.search(r"([\w가-힣]+\.(?:csv|json|xlsx))", text)
    if m:
        query.export_path = m.group(1)
        text = text[:m.start()] + text[m.end():]

    return text


def _extract_location(text: str, query: ParsedQuery) -> None:
    """Extract city and district from remaining text.

    Strategy: Try district match first (since district names are more specific),
    then use city to disambiguate if needed.
    """
    SKIP_WORDS = {
        "에서", "의", "에", "로", "를", "을", "가", "이",
        "전체", "모든", "아파트", "매물", "정보",
        "알려줘", "보여줘", "검색", "찾아줘", "가져와",
        "로", "으로",
    }

    words = text.split()
    words = [w.strip() for w in words if w.strip()]

    # Phase 1: Identify city candidates (exact/alias match only, not partial)
    city_word = None
    for word in words:
        if word in CITY_BY_NAME:
            city_word = word
            query.city_name = CITY_BY_NAME[word].name
            break

    if city_word:
        words.remove(city_word)
        city_obj = find_city(query.city_name)
        if city_obj:
            load_districts(city_obj.code)

    # Phase 2: Find district from remaining words
    for word in list(words):
        if len(word) < 2 or word in SKIP_WORDS:
            continue

        district = find_district(word, city_name=query.city_name)
        if district:
            query.district_name = district.name
            if not query.city_name:
                query.city_name = district.city_name
            words.remove(word)
            break

    # Phase 3: If no city found via exact match, try partial match on remaining words
    if not query.city_name and not city_word:
        for word in list(words):
            if len(word) < 2 or word in SKIP_WORDS:
                continue
            city = find_city(word)
            if city:
                query.city_name = city.name
                words.remove(word)
                load_districts(city.code)
                # Re-try district search with city context
                if not query.district_name:
                    for w in list(words):
                        if len(w) < 2 or w in SKIP_WORDS:
                            continue
                        district = find_district(w, city_name=query.city_name)
                        if district:
                            query.district_name = district.name
                            words.remove(w)
                            break
                break

    # Remaining meaningful words may be complex name
    remaining_words = [
        w for w in words
        if len(w) >= 2 and w not in SKIP_WORDS
    ]
    if remaining_words:
        query.complex_name = " ".join(remaining_words)
