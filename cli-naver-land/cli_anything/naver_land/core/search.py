"""Search orchestration — NaverListing data model and search logic."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import time

from cli_anything.naver_land.core.districts import (
    District,
    TRADE_TYPES,
    TRADE_TYPE_NAMES,
    find_district,
    find_city,
    load_districts,
)
from cli_anything.naver_land.utils.naver_api import NaverLandApiClient

logger = logging.getLogger(__name__)


# ── Singleton client ──────────────────────────────────────────
_shared_client: NaverLandApiClient | None = None


def get_shared_client() -> NaverLandApiClient:
    """Get or create a shared API client for session reuse."""
    global _shared_client
    if _shared_client is None:
        _shared_client = NaverLandApiClient()
    return _shared_client


def close_shared_client():
    """Close the shared client (call on shutdown)."""
    global _shared_client
    if _shared_client is not None:
        _shared_client.close()
        _shared_client = None


# ── Result cache ──────────────────────────────────────────────
_result_cache: dict[str, tuple[float, list]] = {}
CACHE_TTL = 300  # 5 minutes


def _cache_key(district_name: str, city_name: str | None,
               trade_types: list[str] | None, property_type: str,
               sort: str, limit: int) -> str:
    """Build a cache key from search parameters."""
    parts = [
        district_name,
        city_name or "",
        ":".join(sorted(trade_types)) if trade_types else "all",
        property_type,
        sort,
        str(limit),
    ]
    return "|".join(parts)


def _get_cached(key: str) -> list | None:
    """Return cached results if still valid, else None."""
    if key in _result_cache:
        ts, results = _result_cache[key]
        if time.time() - ts < CACHE_TTL:
            return results
        del _result_cache[key]
    return None


def _set_cache(key: str, results: list):
    """Store results in cache."""
    _result_cache[key] = (time.time(), results)


def classify_size(spc1: float) -> str:
    """Classify area into size type based on spc1 (exclusive area in sqm)."""
    if spc1 < 66:
        return "소형"
    elif spc1 <= 99:
        return "20평대"
    elif spc1 <= 132:
        return "30평대"
    else:
        return "중대형"


def sqm_to_pyeong(sqm: float) -> float:
    """Convert square meters to pyeong."""
    return round(sqm / 3.3058, 1)


@dataclass(frozen=True)
class NaverListing:
    atcl_no: str
    atcl_nm: str
    trad_tp_cd: str
    trad_tp_nm: str
    rlet_tp_nm: str
    cortarNo: str
    spc1: float
    spc2: float
    prc: str
    rent_prc: str | None
    lat: float
    lng: float
    flr_info: str | None
    cfm_ymd: str | None
    tag_list: list[str]
    size_type: str
    pyeong: float

    @classmethod
    def from_api_response(cls, item: dict) -> "NaverListing":
        # API returns spc2=전용면적, spc1=공급면적 (reversed from older API)
        # We use spc2 (전용면적) for size classification
        raw_spc1 = _safe_float(item.get("spc1", "0"))
        raw_spc2 = _safe_float(item.get("spc2", "0"))

        # Determine which is 전용 vs 공급: 전용 < 공급 always
        if raw_spc1 > 0 and raw_spc2 > 0:
            exclusive_area = min(raw_spc1, raw_spc2)
            supply_area = max(raw_spc1, raw_spc2)
        else:
            exclusive_area = raw_spc2 if raw_spc2 > 0 else raw_spc1
            supply_area = raw_spc1 if raw_spc1 > 0 else raw_spc2

        trad_tp_cd = item.get("tradTpCd", "")

        # tagList can be a list (new API) or comma-separated string (old API)
        raw_tags = item.get("tagList", "")
        if isinstance(raw_tags, list):
            tags = [str(t).strip() for t in raw_tags if t]
        elif isinstance(raw_tags, str) and raw_tags:
            tags = [t.strip() for t in raw_tags.split(",")]
        else:
            tags = []

        # prc can be numeric (new API) or string; hanPrc has Korean format
        # complexArticleList uses prcInfo instead of prc/hanPrc
        raw_prc = item.get("prc", "")
        han_prc = item.get("hanPrc", "")
        prc_info = item.get("prcInfo", "")
        prc_str = han_prc if han_prc else (prc_info if prc_info else str(raw_prc))

        # rentPrc: 0 means no rent; also check tradeRentPrice
        raw_rent = item.get("rentPrc", 0) or item.get("tradeRentPrice", 0)
        rent_prc = str(raw_rent) if raw_rent and raw_rent != 0 else None

        # cfmYmd: try both old and new field names
        cfm_ymd = item.get("atclCfmYmd") or item.get("cfmYmd") or None

        return cls(
            atcl_no=str(item.get("atclNo", "")),
            atcl_nm=item.get("atclNm", ""),
            trad_tp_cd=trad_tp_cd,
            trad_tp_nm=TRADE_TYPE_NAMES.get(trad_tp_cd, item.get("tradTpNm", "")),
            rlet_tp_nm=item.get("rletTpNm", ""),
            cortarNo=item.get("cortarNo", ""),
            spc1=exclusive_area,
            spc2=supply_area,
            prc=prc_str,
            rent_prc=rent_prc,
            lat=_safe_float(item.get("lat", "0")),
            lng=_safe_float(item.get("lng", "0")),
            flr_info=item.get("flrInfo") or None,
            cfm_ymd=cfm_ymd,
            tag_list=tags,
            size_type=classify_size(exclusive_area),
            pyeong=sqm_to_pyeong(exclusive_area),
        )

    def to_dict(self) -> dict:
        return {
            "atcl_no": self.atcl_no,
            "atcl_nm": self.atcl_nm,
            "trad_tp_nm": self.trad_tp_nm,
            "rlet_tp_nm": self.rlet_tp_nm,
            "cortarNo": self.cortarNo,
            "spc1": self.spc1,
            "spc2": self.spc2,
            "pyeong": self.pyeong,
            "size_type": self.size_type,
            "prc": self.prc,
            "rent_prc": self.rent_prc,
            "flr_info": self.flr_info,
            "cfm_ymd": self.cfm_ymd,
            "tag_list": self.tag_list,
        }

    def to_table_row(self) -> list[str]:
        price = self.prc
        if self.rent_prc:
            price = f"{self.prc}/{self.rent_prc}"
        return [
            self.atcl_nm,
            self.trad_tp_nm,
            f"{self.pyeong}평 ({self.spc1}㎡)",
            self.size_type,
            price,
            self.flr_info or "-",
            self.cortarNo,
        ]


def _safe_float(val) -> float:
    try:
        return float(str(val).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def search_region(
    district_name: str,
    trade_types: list[str] | None = None,
    property_type: str = "APT:JGC",
    sort: str = "rank",
    limit: int = 1000,
    client: NaverLandApiClient | None = None,
    on_progress: callable = None,
    city_name: str | None = None,
) -> list[NaverListing]:
    """Search listings in a district.

    Args:
        district_name: Korean name of the district (e.g. "강남구", "해운대구")
        trade_types: List of trade type names (매매/전세/월세/단기임대). None = all.
        property_type: Property type code (APT/VL/OPST/OR/ABYG/JGC/DDDGG).
        sort: Sort order (rank/prc/spc/date).
        limit: Maximum number of results.
        client: Optional API client (created if not provided).
        on_progress: Optional callback(page, total_so_far).
        city_name: Optional city/province name (e.g. "부산시"). None = auto-detect.

    Returns:
        List of NaverListing objects.
    """
    # If city specified, load its districts first to enable lookup
    if city_name:
        city = find_city(city_name)
        if city is None:
            raise ValueError(f"시/도를 찾을 수 없습니다: {city_name}")
        load_districts(city.code)

    district = find_district(district_name, city_name=city_name)
    if district is None:
        raise ValueError(f"지역을 찾을 수 없습니다: {district_name}")

    # Build trade type code string
    if trade_types:
        codes = []
        for tt in trade_types:
            code = TRADE_TYPES.get(tt)
            if code is None:
                raise ValueError(f"알 수 없는 거래유형: {tt} (가능: {', '.join(TRADE_TYPES.keys())})")
            codes.append(code)
        trad_tp_cd = ":".join(codes)
    else:
        trad_tp_cd = "A1:B1:B2:B3"

    # Check cache first
    ckey = _cache_key(district_name, city_name, trade_types, property_type, sort, limit)
    cached = _get_cached(ckey)
    if cached is not None:
        return cached

    # Use shared client if none provided
    own_client = client is None
    if own_client:
        client = get_shared_client()

    try:
        raw_articles = client.fetch_all_pages(
            cortarNo=district.cortarNo,
            coord_params=district.coord_params,
            rletTpCd=property_type,
            tradTpCd=trad_tp_cd,
            sort=sort,
            limit=limit,
            on_progress=on_progress,
        )
    finally:
        # Only close if user passed their own client and it's not the shared one
        pass

    listings = []
    for item in raw_articles:
        try:
            listings.append(NaverListing.from_api_response(item))
        except Exception:
            continue

    _set_cache(ckey, listings)
    return listings


def listing_url(atcl_no: str) -> str:
    """Generate Naver Land article URL from article number."""
    return f"https://m.land.naver.com/article/info/{atcl_no}"


def district_map_url(district: District, trade_type: str = "A1") -> str:
    """Generate Naver Land map URL for a district."""
    lat = (district.btm + district.top) / 2
    lon = (district.lft + district.rgt) / 2
    return (
        f"https://m.land.naver.com/map/"
        f"{lat:.6f}:{lon:.6f}:{district.zoom}:"
        f"{district.cortarNo}/APT:JGC/{trade_type}"
    )


def _build_trade_code(trade_types: list[str] | None) -> str:
    """Build trade type code string from trade type names."""
    if trade_types:
        codes = []
        for tt in trade_types:
            code = TRADE_TYPES.get(tt)
            if code is None:
                raise ValueError(
                    f"알 수 없는 거래유형: {tt} (가능: {', '.join(TRADE_TYPES.keys())})"
                )
            codes.append(code)
        return ":".join(codes)
    return "A1:B1:B2:B3"


def _fetch_articles_for_complexes(
    client: NaverLandApiClient,
    complexes: list[dict],
    trad_tp_cd: str,
    limit: int,
) -> list[NaverListing]:
    """Fetch article listings for a list of complexes by hscpNo."""
    all_listings: list[NaverListing] = []
    for cx in complexes:
        remaining = limit - len(all_listings)
        if remaining <= 0:
            break
        articles = client.fetch_complex_articles(
            hscpNo=str(cx["hscpNo"]),
            tradTpCd=trad_tp_cd,
            limit=remaining,
        )
        for item in articles:
            try:
                all_listings.append(NaverListing.from_api_response(item))
            except Exception:
                continue
    return all_listings[:limit]


def search_complex(
    complex_name: str,
    district_name: str | None = None,
    trade_types: list[str] | None = None,
    property_type: str = "APT",
    limit: int = 50,
    client: NaverLandApiClient | None = None,
    city_name: str | None = None,
) -> list[NaverListing]:
    """Search listings by complex name — 3-step fallback.

    Step 1: Search redirect → hscpNo → getComplexArticleList (fastest)
    Step 2: complexList → hscpNo match → getComplexArticleList
    Step 3: search_region → client-side filter (slowest fallback)
    """
    trad_tp_cd = _build_trade_code(trade_types)
    client = client or get_shared_client()

    # ── Step 1: Search redirect (no district required) ────────
    search_results = client.search_complex_by_name(complex_name)
    if search_results:
        logger.info(
            f"Step 1 hit: search redirect found {len(search_results)} "
            f"complex(es) for '{complex_name}'"
        )
        articles = _fetch_articles_for_complexes(
            client, search_results, trad_tp_cd, limit,
        )
        if articles:
            return articles

    # ── Step 2/3 require district ─────────────────────────────
    if district_name is None:
        logger.info("No district specified, cannot fall back to Step 2/3")
        return []

    if city_name:
        city = find_city(city_name)
        if city is None:
            raise ValueError(f"시/도를 찾을 수 없습니다: {city_name}")
        load_districts(city.code)

    district = find_district(district_name, city_name=city_name)
    if district is None:
        raise ValueError(f"지역을 찾을 수 없습니다: {district_name}")

    # ── Step 2: complexList → hscpNo match ────────────────────
    rlet_tp_cd = property_type.split(":")[0]
    complexes = client.fetch_complex_list(
        cortarNo=district.cortarNo,
        coord_params=district.coord_params,
        rletTpCd=rlet_tp_cd,
        target_name=complex_name,
    )

    matched = [c for c in complexes if complex_name in c.get("hscpNm", "")]
    if matched:
        logger.info(
            f"Step 2 hit: complexList matched {len(matched)} complex(es)"
        )
        articles = _fetch_articles_for_complexes(
            client, matched, trad_tp_cd, limit,
        )
        if articles:
            return articles

    # ── Step 3: region-wide search + filter (slowest) ─────────
    logger.info("Step 3: falling back to region-wide search + filter")
    return _search_complex_fallback(
        complex_name, district_name, trade_types,
        property_type, limit, client, city_name,
    )


def _search_complex_fallback(
    complex_name: str,
    district_name: str,
    trade_types: list[str] | None,
    property_type: str,
    limit: int,
    client: NaverLandApiClient,
    city_name: str | None,
) -> list[NaverListing]:
    """Fallback: fetch all region listings and filter by name."""
    all_listings = search_region(
        district_name=district_name,
        trade_types=trade_types,
        property_type=property_type,
        limit=500,
        client=client,
        city_name=city_name,
    )
    matched = [
        listing for listing in all_listings
        if complex_name in listing.atcl_nm
    ]
    return matched[:limit]
