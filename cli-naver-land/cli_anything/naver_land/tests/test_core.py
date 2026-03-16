"""Unit tests for Naver Land CLI core modules."""

from __future__ import annotations

import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from cli_anything.naver_land.core.districts import (
    District,
    SEOUL_DISTRICTS,
    TRADE_TYPES,
    PROPERTY_TYPES,
    SORT_OPTIONS,
    find_district,
    list_districts,
)
from cli_anything.naver_land.core.search import (
    NaverListing,
    classify_size,
    sqm_to_pyeong,
    search_region,
    search_complex,
)
from cli_anything.naver_land.utils.naver_api import NaverLandApiClient
from cli_anything.naver_land.core.filter import (
    parse_price,
    parse_floor_filter,
    extract_floor,
    FilterCriteria,
    apply_filters,
)
from cli_anything.naver_land.core.session import Session, HistoryEntry
from cli_anything.naver_land.core.export import export_csv, export_json


# ── Districts tests ─────────────────────────────────────────────

class TestDistricts:
    def test_seoul_25_districts(self):
        assert len(SEOUL_DISTRICTS) == 25

    def test_district_data_structure(self):
        gangnam = SEOUL_DISTRICTS["680"]
        assert gangnam.name == "강남구"
        assert gangnam.city_code == "11"
        assert gangnam.city_name == "서울시"
        assert gangnam.zoom == 13

    def test_cortarNo(self):
        gangnam = SEOUL_DISTRICTS["680"]
        assert gangnam.cortarNo == "1168000000"

    def test_coord_params(self):
        gangnam = SEOUL_DISTRICTS["680"]
        params = gangnam.coord_params
        assert "&z=13" in params
        assert "&btm=" in params
        assert "&lft=" in params
        assert "&top=" in params
        assert "&rgt=" in params

    def test_find_district_exact(self):
        d = find_district("강남구")
        assert d is not None
        assert d.name == "강남구"

    def test_find_district_without_gu(self):
        d = find_district("강남")
        assert d is not None
        assert d.name == "강남구"

    def test_find_district_partial(self):
        d = find_district("서초")
        assert d is not None
        assert d.name == "서초구"

    def test_find_district_not_found(self):
        d = find_district("부산")
        assert d is None

    def test_list_districts_count(self):
        districts = list_districts()
        assert len(districts) == 25

    def test_trade_types(self):
        assert TRADE_TYPES["매매"] == "A1"
        assert TRADE_TYPES["전세"] == "B1"
        assert TRADE_TYPES["월세"] == "B2"
        assert TRADE_TYPES["단기임대"] == "B3"

    def test_property_types(self):
        assert "APT" in PROPERTY_TYPES
        assert "VL" in PROPERTY_TYPES
        assert "OPST" in PROPERTY_TYPES
        assert "ABYG" in PROPERTY_TYPES
        assert "JGC" in PROPERTY_TYPES
        assert "DDDGG" in PROPERTY_TYPES
        assert "OR" in PROPERTY_TYPES

    def test_sort_options(self):
        assert "rank" in SORT_OPTIONS
        assert "prc" in SORT_OPTIONS
        assert "spc" in SORT_OPTIONS
        assert "date" in SORT_OPTIONS

    def test_all_districts_have_valid_coords(self):
        for code, district in SEOUL_DISTRICTS.items():
            assert district.btm > 0
            assert district.lft > 0
            assert district.top > district.btm
            assert district.rgt > district.lft

    def test_district_frozen(self):
        d = SEOUL_DISTRICTS["680"]
        with pytest.raises(AttributeError):
            d.name = "test"


# ── Search / NaverListing tests ─────────────────────────────────

class TestNaverListing:
    SAMPLE_API_ITEM = {
        "atclNo": "12345",
        "atclNm": "래미안",
        "tradTpCd": "A1",
        "tradTpNm": "매매",
        "rletTpNm": "아파트",
        "cortarNo": "역삼동",
        "spc1": "84.5",
        "spc2": "112.3",
        "prc": "18억",
        "rentPrc": "",
        "lat": "37.5",
        "lng": "127.0",
        "flrInfo": "15/25",
        "cfmYmd": "20240101",
        "tagList": "역세권,학군",
    }

    def test_from_api_response(self):
        listing = NaverListing.from_api_response(self.SAMPLE_API_ITEM)
        assert listing.atcl_no == "12345"
        assert listing.atcl_nm == "래미안"
        assert listing.trad_tp_nm == "매매"
        assert listing.spc1 == 84.5
        assert listing.prc == "18억"
        assert listing.flr_info == "15/25"
        assert "역세권" in listing.tag_list

    def test_size_classification(self):
        listing = NaverListing.from_api_response(self.SAMPLE_API_ITEM)
        assert listing.size_type == "20평대"

    def test_pyeong_conversion(self):
        listing = NaverListing.from_api_response(self.SAMPLE_API_ITEM)
        assert listing.pyeong == pytest.approx(25.6, abs=0.1)

    def test_to_dict(self):
        listing = NaverListing.from_api_response(self.SAMPLE_API_ITEM)
        d = listing.to_dict()
        assert d["atcl_no"] == "12345"
        assert d["size_type"] == "20평대"
        assert isinstance(d["tag_list"], list)

    def test_to_table_row(self):
        listing = NaverListing.from_api_response(self.SAMPLE_API_ITEM)
        row = listing.to_table_row()
        assert len(row) == 7
        assert row[0] == "래미안"

    def test_rent_prc_none_when_empty(self):
        listing = NaverListing.from_api_response(self.SAMPLE_API_ITEM)
        assert listing.rent_prc is None

    def test_rent_prc_with_value(self):
        item = {**self.SAMPLE_API_ITEM, "tradTpCd": "B2", "rentPrc": "80"}
        listing = NaverListing.from_api_response(item)
        assert listing.rent_prc == "80"

    def test_missing_fields_default(self):
        listing = NaverListing.from_api_response({})
        assert listing.atcl_no == ""
        assert listing.spc1 == 0.0
        assert listing.tag_list == []


class TestClassifySize:
    def test_small(self):
        assert classify_size(50) == "소형"
        assert classify_size(65.9) == "소형"

    def test_20pyeong(self):
        assert classify_size(66) == "20평대"
        assert classify_size(84) == "20평대"
        assert classify_size(99) == "20평대"

    def test_30pyeong(self):
        assert classify_size(99.1) == "30평대"
        assert classify_size(115) == "30평대"
        assert classify_size(132) == "30평대"

    def test_large(self):
        assert classify_size(132.1) == "중대형"
        assert classify_size(200) == "중대형"


class TestSqmToPyeong:
    def test_basic(self):
        assert sqm_to_pyeong(33.058) == pytest.approx(10.0, abs=0.1)

    def test_84sqm(self):
        result = sqm_to_pyeong(84)
        assert 25 <= result <= 26


# ── Filter tests ────────────────────────────────────────────────

class TestParsePrice:
    def test_eok_with_remainder(self):
        assert parse_price("8억 5,000") == 85000

    def test_eok_only(self):
        assert parse_price("5억") == 50000

    def test_plain_number(self):
        assert parse_price("50000") == 50000

    def test_eok_with_small_remainder(self):
        assert parse_price("1억 2,500") == 12500

    def test_plain_with_comma(self):
        assert parse_price("3,000") == 3000

    def test_20eok(self):
        assert parse_price("20억") == 200000

    def test_empty(self):
        assert parse_price("") == 0

    def test_invalid(self):
        assert parse_price("abc") == 0

    def test_eok_space(self):
        assert parse_price("  10억  ") == 100000


class TestParseFloorFilter:
    def test_plus(self):
        assert parse_floor_filter("10+") == (10, None)

    def test_range(self):
        assert parse_floor_filter("3-10") == (3, 10)

    def test_single(self):
        assert parse_floor_filter("5") == (5, 5)


class TestExtractFloor:
    def test_with_total(self):
        assert extract_floor("15/25") == 15

    def test_single(self):
        assert extract_floor("3") == 3

    def test_none(self):
        assert extract_floor(None) is None

    def test_empty(self):
        assert extract_floor("") is None


class TestFilterCriteria:
    def test_is_empty(self):
        f = FilterCriteria()
        assert f.is_empty

    def test_not_empty(self):
        f = FilterCriteria(size_type="30평대")
        assert not f.is_empty

    def test_to_dict(self):
        f = FilterCriteria(size_type="30평대", min_price="10억")
        d = f.to_dict()
        assert d["size_type"] == "30평대"
        assert d["min_price"] == "10억"
        assert "max_price" not in d


class TestApplyFilters:
    def _make_listing(self, spc1=84, prc="10억", flr="10/20", trad="A1"):
        return NaverListing.from_api_response({
            "atclNo": "1", "atclNm": "테스트", "tradTpCd": trad,
            "rletTpNm": "아파트", "cortarNo": "역삼동",
            "spc1": str(spc1), "spc2": str(spc1 * 1.3),
            "prc": prc, "rentPrc": "", "lat": "37.5", "lng": "127.0",
            "flrInfo": flr, "cfmYmd": "", "tagList": "",
        })

    def test_filter_by_size_type(self):
        listings = [self._make_listing(spc1=50), self._make_listing(spc1=84)]
        result = apply_filters(listings, FilterCriteria(size_type="20평대"))
        assert len(result) == 1

    def test_filter_by_min_area(self):
        listings = [self._make_listing(spc1=50), self._make_listing(spc1=84)]
        result = apply_filters(listings, FilterCriteria(min_area=60))
        assert len(result) == 1

    def test_filter_by_max_area(self):
        listings = [self._make_listing(spc1=50), self._make_listing(spc1=150)]
        result = apply_filters(listings, FilterCriteria(max_area=100))
        assert len(result) == 1

    def test_filter_by_price(self):
        listings = [self._make_listing(prc="5억"), self._make_listing(prc="15억")]
        result = apply_filters(listings, FilterCriteria(min_price="10억"))
        assert len(result) == 1
        assert result[0].prc == "15억"

    def test_filter_by_max_price(self):
        listings = [self._make_listing(prc="5억"), self._make_listing(prc="15억")]
        result = apply_filters(listings, FilterCriteria(max_price="10억"))
        assert len(result) == 1
        assert result[0].prc == "5억"

    def test_filter_by_floor(self):
        listings = [self._make_listing(flr="3/20"), self._make_listing(flr="15/20")]
        result = apply_filters(listings, FilterCriteria(floor="10+"))
        assert len(result) == 1

    def test_combined_filters(self):
        listings = [
            self._make_listing(spc1=84, prc="10억"),
            self._make_listing(spc1=115, prc="15억"),
            self._make_listing(spc1=50, prc="3억"),
        ]
        result = apply_filters(listings, FilterCriteria(
            size_type="30평대", min_price="10억"
        ))
        assert len(result) == 1

    def test_empty_filter_returns_all(self):
        listings = [self._make_listing(), self._make_listing()]
        result = apply_filters(listings, FilterCriteria())
        assert len(result) == 2


# ── Session tests ───────────────────────────────────────────────

class TestSession:
    def test_record_and_history(self):
        sess = Session()
        sess.record("search", {"district": "강남구"})
        history = sess.history()
        assert len(history) == 1
        assert history[0]["command"] == "search"

    def test_undo(self):
        sess = Session()
        sess.record("cmd1", {})
        sess.record("cmd2", {})
        entry = sess.undo()
        assert entry.command == "cmd2"
        assert sess.history_count == 1

    def test_redo(self):
        sess = Session()
        sess.record("cmd1", {})
        sess.undo()
        entry = sess.redo()
        assert entry.command == "cmd1"
        assert sess.history_count == 1

    def test_undo_empty(self):
        sess = Session()
        assert sess.undo() is None

    def test_redo_empty(self):
        sess = Session()
        assert sess.redo() is None

    def test_status(self):
        sess = Session()
        sess.record("cmd1", {})
        status = sess.status()
        assert status["history_count"] == 1
        assert status["can_undo"] is True
        assert status["can_redo"] is False

    def test_save_and_load(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            path = f.name
        try:
            sess1 = Session()
            sess1.record("cmd1", {"key": "val"})
            sess1.save(path)

            sess2 = Session(session_file=path)
            assert sess2.history_count == 1
            assert sess2.history()[0]["command"] == "cmd1"
        finally:
            os.unlink(path)


class TestHistoryEntry:
    def test_to_dict(self):
        e = HistoryEntry(command="test", args={"a": 1})
        d = e.to_dict()
        assert d["command"] == "test"
        assert d["args"] == {"a": 1}
        assert d["timestamp"]

    def test_from_dict(self):
        e = HistoryEntry.from_dict({
            "command": "test",
            "args": {"a": 1},
            "timestamp": "2024-01-01T00:00:00",
        })
        assert e.command == "test"


# ── Export tests ────────────────────────────────────────────────

class TestExport:
    def _make_listing(self):
        return NaverListing.from_api_response({
            "atclNo": "1", "atclNm": "테스트아파트", "tradTpCd": "A1",
            "rletTpNm": "아파트", "cortarNo": "역삼동",
            "spc1": "84", "spc2": "112", "prc": "10억",
            "rentPrc": "", "lat": "37.5", "lng": "127.0",
            "flrInfo": "10/20", "cfmYmd": "20240101", "tagList": "역세권",
        })

    def test_export_csv(self):
        listings = [self._make_listing()]
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            path = f.name
        try:
            result = export_csv(listings, path)
            assert result["count"] == 1
            assert result["format"] == "csv"
            assert result["size"] > 0
            with open(path, encoding="utf-8-sig") as f:
                content = f.read()
            assert "테스트아파트" in content
        finally:
            os.unlink(path)

    def test_export_json(self):
        listings = [self._make_listing()]
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            path = f.name
        try:
            result = export_json(listings, path)
            assert result["count"] == 1
            assert result["format"] == "json"
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            assert len(data) == 1
            assert data[0]["atcl_nm"] == "테스트아파트"
        finally:
            os.unlink(path)


# ── Search with mocked API ──────────────────────────────────────

class TestSearchRegionMocked:
    @pytest.fixture(autouse=True)
    def clear_caches(self):
        """Clear search caches and shared client between tests."""
        from cli_anything.naver_land.core.search import _result_cache, close_shared_client
        _result_cache.clear()
        close_shared_client()
        yield
        _result_cache.clear()
        close_shared_client()

    MOCK_API_RESPONSE = {
        "body": [
            {
                "atclNo": "100", "atclNm": "테스트아파트", "tradTpCd": "A1",
                "rletTpNm": "아파트", "cortarNo": "역삼동",
                "spc1": "84", "spc2": "112", "prc": "10억",
                "rentPrc": "", "lat": "37.5", "lng": "127.0",
                "flrInfo": "10/20", "cfmYmd": "20240101", "tagList": "",
            }
        ]
    }

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_all_pages")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_region_basic(self, mock_session, mock_fetch):
        mock_fetch.return_value = self.MOCK_API_RESPONSE["body"]
        mock_session.return_value = MagicMock()

        results = search_region("강남구", limit=10)
        assert len(results) == 1
        assert results[0].atcl_nm == "테스트아파트"

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_all_pages")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_region_with_trade_type(self, mock_session, mock_fetch):
        mock_fetch.return_value = self.MOCK_API_RESPONSE["body"]
        mock_session.return_value = MagicMock()

        results = search_region("강남구", trade_types=["매매"], limit=10)
        assert len(results) == 1

    def test_search_region_invalid_district(self):
        with pytest.raises(ValueError, match="지역을 찾을 수 없습니다"):
            search_region("부산광역시", limit=1)

    def test_search_region_invalid_trade_type(self):
        with pytest.raises(ValueError, match="알 수 없는 거래유형"):
            search_region("강남구", trade_types=["잘못된유형"], limit=1)

    # ── Step 1: search redirect tests ──────────────────────────

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_articles")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_via_redirect_302(self, mock_session, mock_search, mock_articles):
        """Step 1: single match via 302 redirect → hscpNo → articles."""
        mock_session.return_value = MagicMock()
        mock_search.return_value = [{"hscpNo": "659", "hscpNm": "목동7단지"}]
        mock_articles.return_value = self.MOCK_API_RESPONSE["body"]

        results = search_complex("목동7단지", district_name="양천구", limit=10)
        assert len(results) == 1
        mock_search.assert_called_once_with("목동7단지")

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_articles")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_via_redirect_200(self, mock_session, mock_search, mock_articles):
        """Step 1: multiple matches via 200 HTML → first complex used."""
        mock_session.return_value = MagicMock()
        mock_search.return_value = [
            {"hscpNo": "22853", "hscpNm": ""},
            {"hscpNo": "168097", "hscpNm": ""},
        ]
        mock_articles.return_value = self.MOCK_API_RESPONSE["body"]

        results = search_complex("반포자이", district_name="서초구", limit=10)
        assert len(results) >= 1
        mock_search.assert_called_once_with("반포자이")

    # ── Step 2: complexList fallback tests ────────────────────

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_articles")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_list")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_basic(self, mock_session, mock_search, mock_complex_list, mock_complex_articles):
        """Step 1 misses → Step 2 finds via complexList."""
        mock_session.return_value = MagicMock()
        mock_search.return_value = []  # Step 1 fails
        mock_complex_list.return_value = [
            {"hscpNo": "12345", "hscpNm": "테스트아파트", "totAtclCnt": 1},
        ]
        mock_complex_articles.return_value = self.MOCK_API_RESPONSE["body"]

        results = search_complex("테스트", district_name="강남구", limit=10)
        assert len(results) == 1

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_articles")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_list")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_no_match(self, mock_session, mock_search, mock_complex_list, mock_complex_articles):
        mock_session.return_value = MagicMock()
        mock_search.return_value = []  # Step 1 fails
        mock_complex_list.return_value = [
            {"hscpNo": "99999", "hscpNm": "다른아파트", "totAtclCnt": 5},
        ]

        results = search_complex("없는단지", district_name="강남구", limit=10)
        assert len(results) == 0
        mock_complex_articles.assert_not_called()

    # ── Step 3: region-wide fallback tests ────────────────────

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_all_pages")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_list")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_fallback_empty_list(self, mock_session, mock_search, mock_complex_list, mock_fetch):
        """Falls back to region search when both Step 1 and Step 2 fail."""
        mock_session.return_value = MagicMock()
        mock_search.return_value = []  # Step 1 fails
        mock_complex_list.return_value = []  # Step 2 fails
        mock_fetch.return_value = self.MOCK_API_RESPONSE["body"]

        results = search_complex("테스트", district_name="강남구", limit=10)
        assert len(results) == 1

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_all_pages")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_list")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_fallback_no_match(self, mock_session, mock_search, mock_complex_list, mock_fetch):
        """Falls back to region search when target not in complexList."""
        mock_session.return_value = MagicMock()
        mock_search.return_value = []  # Step 1 fails
        mock_complex_list.return_value = [
            {"hscpNo": "99999", "hscpNm": "다른아파트", "totAtclCnt": 5},
        ]
        mock_fetch.return_value = self.MOCK_API_RESPONSE["body"]

        results = search_complex("테스트", district_name="강남구", limit=10)
        assert len(results) == 1
        mock_fetch.assert_called_once()  # Verify fallback was used

    # ── No district → Step 1 only ─────────────────────────────

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.fetch_complex_articles")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_no_district_with_redirect(self, mock_session, mock_search, mock_articles):
        """Without district, Step 1 works; returns empty if Step 1 misses."""
        mock_session.return_value = MagicMock()
        mock_search.return_value = [{"hscpNo": "659", "hscpNm": "목동7단지"}]
        mock_articles.return_value = self.MOCK_API_RESPONSE["body"]

        results = search_complex("목동7단지", limit=10)
        assert len(results) == 1

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient.search_complex_by_name")
    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._ensure_session")
    def test_search_complex_no_district_no_redirect(self, mock_session, mock_search):
        """Without district and no redirect match, returns empty list."""
        mock_session.return_value = MagicMock()
        mock_search.return_value = []

        results = search_complex("없는아파트", limit=10)
        assert len(results) == 0


# ── NaverLandApiClient.search_complex_by_name unit tests ──────

class TestSearchComplexByName:
    """Unit tests for the search redirect method on NaverLandApiClient."""

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._visit_main_page")
    def test_302_redirect_single_match(self, mock_visit):
        """302 redirect → extracts hscpNo from Location header."""
        client = NaverLandApiClient()
        mock_response = MagicMock()
        mock_response.status_code = 302
        mock_response.headers = {"Location": "/complex/info/659"}

        mock_session = MagicMock()
        mock_session.get.return_value = mock_response
        client._session = mock_session
        client._current_profile = {"ua": "test", "sec_ch_ua": None, "sec_ch_ua_platform": None, "sec_ch_ua_mobile": None}

        result = client.search_complex_by_name("목동7단지")
        assert result == [{"hscpNo": "659", "hscpNm": "목동7단지"}]

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._visit_main_page")
    def test_200_multiple_matches(self, mock_visit):
        """200 response → extracts multiple hscpNo from HTML."""
        client = NaverLandApiClient()
        html = (
            '<a href="/complex/info/22853">반포자이</a>'
            '<a href="/complex/info/168097">반포자이2</a>'
            '<a href="/complex/info/22853">반포자이</a>'  # duplicate
        )
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = html

        mock_session = MagicMock()
        mock_session.get.return_value = mock_response
        client._session = mock_session
        client._current_profile = {"ua": "test", "sec_ch_ua": None, "sec_ch_ua_platform": None, "sec_ch_ua_mobile": None}

        result = client.search_complex_by_name("반포자이")
        assert len(result) == 2  # deduplicated
        assert result[0]["hscpNo"] == "22853"
        assert result[1]["hscpNo"] == "168097"

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._visit_main_page")
    def test_200_no_complex_links(self, mock_visit):
        """200 response with no complex links → empty list."""
        client = NaverLandApiClient()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>No results</body></html>"

        mock_session = MagicMock()
        mock_session.get.return_value = mock_response
        client._session = mock_session
        client._current_profile = {"ua": "test", "sec_ch_ua": None, "sec_ch_ua_platform": None, "sec_ch_ua_mobile": None}

        result = client.search_complex_by_name("없는아파트")
        assert result == []

    @patch("cli_anything.naver_land.utils.naver_api.NaverLandApiClient._visit_main_page")
    def test_request_exception(self, mock_visit):
        """Request exception → empty list (no crash)."""
        import requests as req
        client = NaverLandApiClient()
        mock_session = MagicMock()
        mock_session.get.side_effect = req.exceptions.Timeout("timeout")
        client._session = mock_session
        client._current_profile = {"ua": "test", "sec_ch_ua": None, "sec_ch_ua_platform": None, "sec_ch_ua_mobile": None}

        result = client.search_complex_by_name("타임아웃")
        assert result == []
