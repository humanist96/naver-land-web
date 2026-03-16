"""E2E tests for Naver Land CLI — requires network access to Naver Land API.

Run with: pytest cli_anything/naver_land/tests/test_full_e2e.py -v -s
Skip with: pytest -m "not e2e"
"""

from __future__ import annotations

import os
import tempfile

import pytest

from cli_anything.naver_land.core.search import search_region, search_complex
from cli_anything.naver_land.core.filter import apply_filters, FilterCriteria
from cli_anything.naver_land.core.export import export_csv, export_json
from cli_anything.naver_land.core.districts import list_districts, find_district
from cli_anything.naver_land.utils.naver_api import NaverLandApiClient

pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def api_client():
    client = NaverLandApiClient(delay_mean=3.0, delay_min=2.0, delay_max=5.0)
    yield client
    client.close()


class TestE2ESearch:
    """E2E tests using real Naver Land API (종로구, small page count)."""

    def test_search_jongno_basic(self, api_client):
        """Search 종로구 with limit=5 — basic connectivity test."""
        results = search_region("종로구", limit=5, client=api_client)
        assert len(results) > 0
        assert results[0].atcl_nm  # has apartment name

    def test_search_jongno_trade_type(self, api_client):
        """Search 종로구 매매 only."""
        results = search_region("종로구", trade_types=["매매"], limit=5, client=api_client)
        for r in results:
            assert r.trad_tp_cd == "A1"

    def test_search_jongno_jeonse(self, api_client):
        """Search 종로구 전세 only."""
        results = search_region("종로구", trade_types=["전세"], limit=5, client=api_client)
        for r in results:
            assert r.trad_tp_cd == "B1"

    def test_search_jongno_villa(self, api_client):
        """Search 종로구 빌라."""
        results = search_region("종로구", property_type="VL", limit=5, client=api_client)
        assert isinstance(results, list)

    def test_search_jongno_officetel(self, api_client):
        """Search 종로구 오피스텔."""
        results = search_region("종로구", property_type="OPST", limit=5, client=api_client)
        assert isinstance(results, list)

    def test_listing_fields(self, api_client):
        """Verify all expected fields are populated."""
        results = search_region("종로구", limit=3, client=api_client)
        if results:
            r = results[0]
            assert r.atcl_no
            assert r.spc1 > 0 or r.spc1 == 0
            assert r.prc
            assert r.size_type in ("소형", "20평대", "30평대", "중대형")
            assert r.pyeong >= 0

    def test_filter_after_search(self, api_client):
        """Search then filter by size type."""
        results = search_region("종로구", limit=20, client=api_client)
        filtered = apply_filters(results, FilterCriteria(size_type="20평대"))
        for r in filtered:
            assert r.size_type == "20평대"

    def test_filter_by_price(self, api_client):
        """Search then filter by price range."""
        results = search_region("종로구", trade_types=["매매"], limit=20, client=api_client)
        filtered = apply_filters(results, FilterCriteria(max_price="20억"))
        assert isinstance(filtered, list)


class TestE2EExport:
    def test_export_csv_e2e(self, api_client):
        """Search and export to CSV."""
        results = search_region("종로구", limit=5, client=api_client)
        if not results:
            pytest.skip("No results from API")
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            path = f.name
        try:
            result = export_csv(results, path)
            assert result["count"] == len(results)
            assert os.path.getsize(path) > 0
        finally:
            os.unlink(path)

    def test_export_json_e2e(self, api_client):
        """Search and export to JSON."""
        results = search_region("종로구", limit=5, client=api_client)
        if not results:
            pytest.skip("No results from API")
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            path = f.name
        try:
            result = export_json(results, path)
            assert result["count"] == len(results)
        finally:
            os.unlink(path)


class TestE2EDistricts:
    def test_all_districts_searchable(self):
        """All 25 districts can be found by name."""
        for d in list_districts():
            found = find_district(d.name)
            assert found is not None
            assert found.name == d.name

    def test_complex_search(self, api_client):
        """Search by complex name in 종로구."""
        results = search_complex("아파트", district_name="종로구", limit=5, client=api_client)
        assert isinstance(results, list)


class TestE2EApiClient:
    def test_fetch_single_page(self, api_client):
        """Fetch a single page of articles."""
        district = find_district("종로구")
        response = api_client.fetch_articles(
            cortarNo=district.cortarNo,
            coord_params=district.coord_params,
            page=1,
        )
        assert response is not None
        assert "body" in response

    def test_fetch_with_sort(self, api_client):
        """Fetch with price sort."""
        district = find_district("종로구")
        response = api_client.fetch_articles(
            cortarNo=district.cortarNo,
            coord_params=district.coord_params,
            sort="prc",
            page=1,
        )
        assert response is not None
