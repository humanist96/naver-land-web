"""Region data — Nationwide cities and districts for Naver Land API.

Supports all 17 시/도 and their 구/군/시 districts.
Seoul districts are embedded as fallback; other regions are fetched
from Naver's cortarList API and cached locally.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class District:
    code: str
    name: str
    city_code: str
    city_name: str
    zoom: int
    btm: float
    lft: float
    top: float
    rgt: float

    @property
    def cortarNo(self) -> str:
        return f"{self.city_code}{self.code}00000"

    @property
    def coord_params(self) -> str:
        return (
            f"&z={self.zoom}"
            f"&btm={self.btm}&lft={self.lft}"
            f"&top={self.top}&rgt={self.rgt}"
        )


@dataclass(frozen=True)
class City:
    code: str
    name: str
    center_lat: float
    center_lon: float

    @property
    def cortarNo(self) -> str:
        return f"{self.code}00000000"


# ── 17 시/도 ──────────────────────────────────────────────────────

CITIES: dict[str, City] = {
    "11": City("11", "서울시", 37.5665, 126.9780),
    "26": City("26", "부산시", 35.1796, 129.0756),
    "27": City("27", "대구시", 35.8714, 128.6014),
    "28": City("28", "인천시", 37.4563, 126.7052),
    "29": City("29", "광주시", 35.1595, 126.8526),
    "30": City("30", "대전시", 36.3504, 127.3845),
    "31": City("31", "울산시", 35.5384, 129.3114),
    "36": City("36", "세종시", 36.4800, 127.2890),
    "41": City("41", "경기도", 37.4138, 127.5183),
    "42": City("42", "강원도", 37.8228, 128.1555),
    "43": City("43", "충청북도", 36.6357, 127.4912),
    "44": City("44", "충청남도", 36.5184, 126.8000),
    "45": City("45", "전라북도", 35.7175, 127.1530),
    "46": City("46", "전라남도", 34.8679, 126.9910),
    "47": City("47", "경상북도", 36.4919, 128.8889),
    "48": City("48", "경상남도", 35.4606, 128.2132),
    "50": City("50", "제주도", 33.4996, 126.5312),
}

# Name-based city lookup (supports multiple name forms)
CITY_BY_NAME: dict[str, City] = {}
for _c in CITIES.values():
    CITY_BY_NAME[_c.name] = _c
    # Allow short forms: "서울", "부산", "대구", etc.
    for _suffix in ("시", "도"):
        if _c.name.endswith(_suffix):
            CITY_BY_NAME[_c.name[:-1]] = _c
    # Special short forms
_CITY_ALIASES = {
    "서울특별시": "11", "부산광역시": "26", "대구광역시": "27",
    "인천광역시": "28", "광주광역시": "29", "대전광역시": "30",
    "울산광역시": "31", "세종특별자치시": "36",
    "경기": "41", "강원": "42", "강원특별자치도": "42",
    "충북": "43", "충남": "44",
    "전북": "45", "전북특별자치도": "45", "전남": "46",
    "경북": "47", "경남": "48",
    "제주": "50", "제주특별자치도": "50",
}
for _alias, _code in _CITY_ALIASES.items():
    CITY_BY_NAME[_alias] = CITIES[_code]


# ── Seoul embedded data (fallback) ────────────────────────────────

def _parse_coords(s: str) -> dict:
    params = {}
    for part in s.strip("&").split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            params[k] = v
    return params


def _build_district(code: str, name: str, coord_str: str,
                    city_code: str = "11", city_name: str = "서울시") -> District:
    p = _parse_coords(coord_str)
    return District(
        code=code, name=name,
        city_code=city_code, city_name=city_name,
        zoom=int(p.get("z", 13)),
        btm=float(p["btm"]), lft=float(p["lft"]),
        top=float(p["top"]), rgt=float(p["rgt"]),
    )


_SEOUL_DATA = {
    "110": ("종로구", "&z=13&btm=37.5138176&lft=126.8804177&top=37.6321853&rgt=127.0788583"),
    "140": ("중구", "&z=13&btm=37.5046273&lft=126.8867068&top=37.6230096&rgt=127.1084932"),
    "170": ("용산구", "&z=13&btm=37.4795905&lft=126.8757428&top=37.5980125&rgt=127.0549572"),
    "200": ("성동구", "&z=13&btm=37.5042601&lft=126.9472308&top=37.6226429&rgt=127.1264452"),
    "215": ("광진구", "&z=13&btm=37.4793823&lft=126.9927678&top=37.5978047&rgt=127.1719822"),
    "230": ("동대문구", "&z=13&btm=37.5152868&lft=126.9501578&top=37.6336522&rgt=127.1293722"),
    "260": ("중랑구", "&z=13&btm=37.5471431&lft=127.0029768&top=37.6654578&rgt=127.1821912"),
    "290": ("성북구", "&z=13&btm=37.5282041&lft=126.9311218&top=37.6465489&rgt=127.1103362"),
    "305": ("강북구", "&z=13&btm=37.5805857&lft=126.9358808&top=37.6988473&rgt=127.1150952"),
    "320": ("도봉구", "&z=13&btm=37.6096368&lft=126.9575558&top=37.7278521&rgt=127.1367702"),
    "350": ("노원구", "&z=13&btm=37.5951433&lft=126.9668038&top=37.7133817&rgt=127.1460182"),
    "380": ("은평구", "&z=13&btm=37.5435963&lft=126.8395558&top=37.6619167&rgt=127.0187702"),
    "410": ("서대문구", "&z=13&btm=37.5200226&lft=126.8471928&top=37.6383804&rgt=127.0264072"),
    "440": ("마포구", "&z=13&btm=37.5043021&lft=126.8187928&top=37.6226849&rgt=126.9980072"),
    "470": ("양천구", "&z=13&btm=37.4577552&lft=126.7769388&top=37.5762118&rgt=126.9561532"),
    "500": ("강서구", "&z=13&btm=37.4917601&lft=126.7599268&top=37.6101628&rgt=126.9391412"),
    "530": ("구로구", "&z=13&btm=37.4362411&lft=126.7979248&top=37.5547319&rgt=126.9771392"),
    "545": ("금천구", "&z=13&btm=37.3926566&lft=126.8124678&top=37.5112164&rgt=126.9916822"),
    "560": ("영등포구", "&z=13&btm=37.4671226&lft=126.8066058&top=37.5855644&rgt=126.9858202"),
    "590": ("동작구", "&z=13&btm=37.4531945&lft=126.8498928&top=37.5716584&rgt=127.0291072"),
    "620": ("관악구", "&z=13&btm=37.4217406&lft=126.8619938&top=37.5402544&rgt=127.0412082"),
    "650": ("서초구", "&z=13&btm=37.4242856&lft=126.9429868&top=37.5427954&rgt=127.1222012"),
    "680": ("강남구", "&z=13&btm=37.4581565&lft=126.9577058&top=37.5766125&rgt=127.1369202"),
    "710": ("송파구", "&z=13&btm=37.4553382&lft=127.0162558&top=37.5737987&rgt=127.1954702"),
    "740": ("강동구", "&z=13&btm=37.4708846&lft=127.0341638&top=37.5893204&rgt=127.2133782"),
}

SEOUL_DISTRICTS: dict[str, District] = {}
for _code, (_name, _coords) in _SEOUL_DATA.items():
    SEOUL_DISTRICTS[_code] = _build_district(_code, _name, _coords)


# ── Nationwide district data ──────────────────────────────────────

_district_cache: dict[str, list[District]] = {
    "11": list(SEOUL_DISTRICTS.values()),
}


def _district_from_center(code: str, name: str, city_code: str, city_name: str,
                          center_lat: float, center_lon: float) -> District:
    """Build a District from center coordinates with approximate bounding box."""
    lat_delta = 0.06
    lon_delta = 0.10
    return District(
        code=code, name=name,
        city_code=city_code, city_name=city_name,
        zoom=13,
        btm=round(center_lat - lat_delta, 7),
        lft=round(center_lon - lon_delta, 7),
        top=round(center_lat + lat_delta, 7),
        rgt=round(center_lon + lon_delta, 7),
    )


def _load_from_embedded_data(city_code: str) -> list[District]:
    """Load districts from hardcoded region data."""
    from cli_anything.naver_land.core._regions_data import REGION_DATA

    entries = REGION_DATA.get(city_code, [])
    city = CITIES.get(city_code)
    if not entries or not city:
        return []

    return [
        _district_from_center(
            code=code, name=name,
            city_code=city_code, city_name=city.name,
            center_lat=lat, center_lon=lon,
        )
        for code, name, lat, lon in entries
    ]


def load_districts(city_code: str) -> list[District]:
    """Load districts for a city from embedded data.

    Priority: memory cache → embedded hardcoded data.
    Seoul uses precise bounding boxes; other cities use approximate ones.
    """
    if city_code in _district_cache:
        return _district_cache[city_code]

    city = CITIES.get(city_code)
    if city is None:
        return []

    districts = _load_from_embedded_data(city_code)
    if districts:
        _district_cache[city_code] = districts

    return districts


# ── Trade / Property / Sort mappings ──────────────────────────────

TRADE_TYPES = {
    "매매": "A1",
    "전세": "B1",
    "월세": "B2",
    "단기임대": "B3",
}

TRADE_TYPE_NAMES = {v: k for k, v in TRADE_TYPES.items()}

PROPERTY_TYPES = {
    "APT": "아파트",
    "VL": "빌라/연립",
    "OPST": "오피스텔",
    "OR": "주거용오피스텔",
    "ABYG": "아파트분양권",
    "JGC": "재건축",
    "DDDGG": "단독/다가구",
}

SORT_OPTIONS = {
    "rank": "추천순",
    "prc": "가격순",
    "spc": "면적순",
    "date": "최신순",
}


# ── Lookup functions ──────────────────────────────────────────────

def find_city(name: str) -> City | None:
    """Find a city by name (supports partial match and aliases)."""
    name = name.strip()
    if name in CITY_BY_NAME:
        return CITY_BY_NAME[name]
    # Partial match
    for cname, city in CITY_BY_NAME.items():
        if name in cname:
            return city
    return None


def find_all_matching_districts(name: str) -> list[District]:
    """Find ALL districts matching a name across all cities.

    Loads all cities and searches for matching districts.
    Returns list of candidates (may be 0, 1, or multiple).
    """
    name = name.strip()
    candidates = []
    for city_code in CITIES:
        districts = load_districts(city_code)
        match = _match_district(name, districts)
        if match:
            candidates.append(match)
    return candidates


def find_district(name: str, city_name: str | None = None) -> District | None:
    """Find a district by name, optionally within a specific city.

    If city_name is None, searches Seoul first, then all loaded caches.
    """
    name = name.strip()

    if city_name:
        city = find_city(city_name)
        if city is None:
            return None
        districts = load_districts(city.code)
        return _match_district(name, districts)

    # Default: search Seoul first
    result = _match_district(name, list(SEOUL_DISTRICTS.values()))
    if result:
        return result

    # Then search all cached districts
    for city_code, districts in _district_cache.items():
        if city_code == "11":
            continue
        result = _match_district(name, districts)
        if result:
            return result

    return None


def _match_district(name: str, districts: list[District]) -> District | None:
    """Match district by exact name, short name, or partial match."""
    # Exact match
    for d in districts:
        if d.name == name:
            return d
    # Without suffix (구/군/시)
    for d in districts:
        for suffix in ("구", "군", "시"):
            if d.name.endswith(suffix) and d.name[:-1] == name:
                return d
    # Partial match
    for d in districts:
        if name in d.name:
            return d
    return None


def list_cities() -> list[City]:
    """Return all cities sorted by code."""
    return sorted(CITIES.values(), key=lambda c: c.code)


def list_districts(city_name: str | None = None) -> list[District]:
    """Return districts for a city (default: Seoul)."""
    if city_name:
        city = find_city(city_name)
        if city is None:
            raise ValueError(f"시/도를 찾을 수 없습니다: {city_name}")
        return sorted(load_districts(city.code), key=lambda d: d.code)
    return sorted(SEOUL_DISTRICTS.values(), key=lambda d: d.code)
