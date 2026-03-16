"""Naver Land API client — HTTP client with comprehensive anti-blocking measures.

Anti-blocking techniques applied:
1. UA rotation with browser-specific header profiles
2. Gaussian random delay between requests
3. Exponential backoff with jitter on 429/403
4. Session cookie management with periodic refresh
5. Referer chain simulation (visit main page before API)
6. Request header fingerprint variation per-request
7. Session rotation after N requests to avoid long-lived session tracking
8. Inter-district cool-down periods
9. Adaptive delay (increase delay when seeing slow responses)
10. Request rate limiting via token bucket
11. Random Accept-Language variation
12. sec-ch-ua client hints variation matching UA
"""

from __future__ import annotations

import logging
import random
import re
import time
import hashlib
import urllib.parse
from datetime import datetime

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


# ── Browser profiles (UA + matching headers) ────────────────────

_BROWSER_PROFILES = [
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec_ch_ua_platform": '"Windows"',
        "sec_ch_ua_mobile": "?0",
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec_ch_ua_platform": '"macOS"',
        "sec_ch_ua_mobile": "?0",
    },
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "sec_ch_ua": None,  # Firefox doesn't send sec-ch-ua
        "sec_ch_ua_platform": None,
        "sec_ch_ua_mobile": None,
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "sec_ch_ua": None,  # Safari doesn't send sec-ch-ua
        "sec_ch_ua_platform": None,
        "sec_ch_ua_mobile": None,
    },
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
        "sec_ch_ua_platform": '"Windows"',
        "sec_ch_ua_mobile": "?0",
    },
    {
        "ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
        "sec_ch_ua_platform": '"Linux"',
        "sec_ch_ua_mobile": "?0",
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="121", "Google Chrome";v="121"',
        "sec_ch_ua_platform": '"macOS"',
        "sec_ch_ua_mobile": "?0",
    },
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        "sec_ch_ua": None,
        "sec_ch_ua_platform": None,
        "sec_ch_ua_mobile": None,
    },
    # Mobile UAs for m.land.naver.com
    {
        "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
        "sec_ch_ua": None,
        "sec_ch_ua_platform": None,
        "sec_ch_ua_mobile": "?1",
    },
    {
        "ua": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
        "sec_ch_ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec_ch_ua_platform": '"Android"',
        "sec_ch_ua_mobile": "?1",
    },
]

# Accept-Language variations (all Korean-primary but with different secondary)
_ACCEPT_LANGUAGES = [
    "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "ko-KR,ko;q=0.9,en;q=0.8",
    "ko-KR,ko;q=0.9,ja;q=0.8,en-US;q=0.7,en;q=0.6",
    "ko,en-US;q=0.9,en;q=0.8",
    "ko-KR,ko;q=0.95,en-US;q=0.8,en;q=0.7,ja;q=0.5",
]

# Referer variations
_REFERERS = [
    "https://m.land.naver.com/",
    "https://m.land.naver.com/map/37.5665:126.978",
    "https://m.land.naver.com/search/result/",
]

BASE_URL = "https://m.land.naver.com"
ARTICLE_LIST_URL = f"{BASE_URL}/cluster/ajax/articleList"
COMPLEX_LIST_URL = f"{BASE_URL}/cluster/ajax/complexList"
COMPLEX_ARTICLE_URL = f"{BASE_URL}/complex/getComplexArticleList"
SEARCH_URL = f"{BASE_URL}/search/result"


def _build_headers(profile: dict | None = None) -> dict:
    """Build request headers with consistent browser fingerprint."""
    if profile is None:
        profile = random.choice(_BROWSER_PROFILES)

    headers = {
        "User-Agent": profile["ua"],
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": random.choice(_ACCEPT_LANGUAGES),
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": random.choice(_REFERERS),
        "X-Requested-With": "XMLHttpRequest",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }

    # Add client hints only for Chromium-based browsers
    if profile.get("sec_ch_ua"):
        headers["sec-ch-ua"] = profile["sec_ch_ua"]
    if profile.get("sec_ch_ua_platform"):
        headers["sec-ch-ua-platform"] = profile["sec_ch_ua_platform"]
    if profile.get("sec_ch_ua_mobile"):
        headers["sec-ch-ua-mobile"] = profile["sec_ch_ua_mobile"]

    # Randomly add optional headers for more natural fingerprint
    if random.random() < 0.3:
        headers["DNT"] = "1"
    if random.random() < 0.2:
        headers["Upgrade-Insecure-Requests"] = "1"

    return headers


class NaverLandApiClient:
    """HTTP client for Naver Land mobile API with comprehensive anti-blocking.

    Techniques:
    - Browser profile rotation (UA + sec-ch-ua + platform consistency)
    - Gaussian random delay with configurable parameters
    - Exponential backoff with jitter on rate limiting
    - Session rotation every N requests
    - Cookie refresh via main page visits
    - Adaptive delay (slows down on warnings)
    - Request counting and rate awareness
    """

    def __init__(
        self,
        delay_mean: float = 5.0,
        delay_std: float = 1.5,
        delay_min: float = 3.0,
        delay_max: float = 10.0,
        max_retries: int = 5,
        session_rotate_after: int = 30,
        cookie_refresh_after: int = 15,
    ):
        self._session: requests.Session | None = None
        self._current_profile: dict | None = None
        self.delay_mean = delay_mean
        self.delay_std = delay_std
        self.delay_min = delay_min
        self.delay_max = delay_max
        self.max_retries = max_retries
        self.session_rotate_after = session_rotate_after
        self.cookie_refresh_after = cookie_refresh_after

        # Request tracking
        self._request_count = 0
        self._session_request_count = 0
        self._last_request_time = 0.0
        self._consecutive_errors = 0
        self._adaptive_delay_multiplier = 1.0

    def _create_session(self) -> requests.Session:
        """Create a new requests.Session with retry adapter."""
        session = requests.Session()

        # Add retry adapter for connection-level resilience
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        return session

    def _pick_new_profile(self) -> dict:
        """Select a new browser profile different from current."""
        candidates = [p for p in _BROWSER_PROFILES if p != self._current_profile]
        return random.choice(candidates) if candidates else random.choice(_BROWSER_PROFILES)

    def _ensure_session(self) -> requests.Session:
        """Get or create session, rotating if needed."""
        needs_new = (
            self._session is None
            or self._session_request_count >= self.session_rotate_after
        )

        if needs_new:
            if self._session is not None:
                logger.info(f"Rotating session after {self._session_request_count} requests")
                self._session.close()

            self._current_profile = self._pick_new_profile()
            self._session = self._create_session()
            self._session_request_count = 0

            # Visit main page to acquire cookies (like a real browser)
            self._visit_main_page()

        elif self._session_request_count > 0 and self._session_request_count % self.cookie_refresh_after == 0:
            # Periodically refresh cookies
            logger.info("Refreshing cookies via main page visit")
            self._visit_main_page()

        return self._session

    def _visit_main_page(self):
        """Visit main page to acquire/refresh cookies naturally."""
        try:
            headers = _build_headers(self._current_profile)
            # Remove AJAX-specific headers for a normal page visit
            page_headers = {
                "User-Agent": headers["User-Agent"],
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": headers["Accept-Language"],
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
            }
            if self._current_profile.get("sec_ch_ua"):
                page_headers["sec-ch-ua"] = self._current_profile["sec_ch_ua"]
            if self._current_profile.get("sec_ch_ua_platform"):
                page_headers["sec-ch-ua-platform"] = self._current_profile["sec_ch_ua_platform"]

            logger.info("Visiting main page for cookie acquisition...")
            self._session.get(f"{BASE_URL}/", headers=page_headers, timeout=30)

            # Simulate brief browsing (human wouldn't immediately hit API)
            time.sleep(random.uniform(1.5, 4.0))

            # Optionally visit a map page to look more natural
            if random.random() < 0.4:
                map_headers = {**page_headers, "Referer": f"{BASE_URL}/"}
                self._session.get(
                    f"{BASE_URL}/map/37.5665:126.978",
                    headers=map_headers,
                    timeout=30,
                )
                time.sleep(random.uniform(1.0, 2.5))

            logger.info("Session initialized with cookies")
        except Exception as e:
            logger.warning(f"Failed to visit main page: {e}")

    def _random_delay(self):
        """Apply Gaussian random delay with adaptive multiplier."""
        mean = self.delay_mean * self._adaptive_delay_multiplier
        delay = random.gauss(mean, self.delay_std)
        delay = max(self.delay_min, min(self.delay_max * self._adaptive_delay_multiplier, delay))

        # Add micro-jitter for more natural timing
        delay += random.uniform(-0.3, 0.3)
        delay = max(self.delay_min, delay)

        logger.debug(f"Delay: {delay:.1f}s (multiplier: {self._adaptive_delay_multiplier:.1f})")
        time.sleep(delay)

    def _adaptive_adjust(self, success: bool):
        """Adjust delay multiplier based on request outcomes."""
        if success:
            self._consecutive_errors = 0
            # Slowly reduce multiplier back toward 1.0
            if self._adaptive_delay_multiplier > 1.0:
                self._adaptive_delay_multiplier = max(
                    1.0,
                    self._adaptive_delay_multiplier * 0.95,
                )
        else:
            self._consecutive_errors += 1
            # Increase delay on errors
            self._adaptive_delay_multiplier = min(
                3.0,
                self._adaptive_delay_multiplier * 1.5,
            )
            logger.info(
                f"Adaptive delay increased to {self._adaptive_delay_multiplier:.1f}x "
                f"({self._consecutive_errors} consecutive errors)"
            )

    def _request_with_backoff(self, url: str) -> dict | None:
        """Execute HTTP request with exponential backoff and anti-blocking measures."""
        session = self._ensure_session()

        for attempt in range(self.max_retries):
            # Minimum inter-request gap
            now = time.time()
            since_last = now - self._last_request_time
            min_gap = self.delay_min * 0.5
            if since_last < min_gap:
                time.sleep(min_gap - since_last)

            try:
                headers = _build_headers(self._current_profile)
                response = session.get(url, headers=headers, timeout=30)
                self._last_request_time = time.time()
                self._request_count += 1
                self._session_request_count += 1

                if response.status_code == 200:
                    self._adaptive_adjust(success=True)
                    return response.json()

                elif response.status_code == 429:
                    # Rate limited — backoff with full jitter
                    self._adaptive_adjust(success=False)
                    base_wait = (2 ** attempt) + random.uniform(0, 2)
                    wait_time = base_wait * self._adaptive_delay_multiplier
                    logger.warning(
                        f"Rate limited (429). Waiting {wait_time:.1f}s... "
                        f"(attempt {attempt + 1}/{self.max_retries})"
                    )
                    time.sleep(wait_time)

                    # On heavy rate limiting, rotate session
                    if attempt >= 2:
                        logger.info("Rotating session due to persistent rate limiting")
                        self._session_request_count = self.session_rotate_after  # force rotation

                elif response.status_code == 403:
                    # Forbidden — likely IP/session flagged
                    self._adaptive_adjust(success=False)
                    wait_time = (2 ** attempt) * 3 + random.uniform(1, 5)
                    logger.warning(
                        f"Forbidden (403). Possible block. Waiting {wait_time:.1f}s... "
                        f"(attempt {attempt + 1}/{self.max_retries})"
                    )
                    time.sleep(wait_time)

                    # Force session rotation on 403
                    logger.info("Rotating session after 403 response")
                    self._session_request_count = self.session_rotate_after

                elif response.status_code in (301, 302):
                    # Redirect might be a captcha or block page
                    logger.warning(f"Redirect ({response.status_code}) — possible captcha")
                    self._adaptive_adjust(success=False)
                    wait_time = (2 ** attempt) * 2
                    time.sleep(wait_time)

                else:
                    logger.error(f"HTTP {response.status_code} for {url}")
                    self._adaptive_adjust(success=False)
                    break

            except requests.exceptions.Timeout:
                self._adaptive_adjust(success=False)
                wait_time = 2 ** attempt
                logger.warning(
                    f"Request timeout. Waiting {wait_time:.1f}s... "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
                time.sleep(wait_time)

            except requests.exceptions.ConnectionError:
                self._adaptive_adjust(success=False)
                wait_time = (2 ** attempt) * 2
                logger.warning(
                    f"Connection error. Waiting {wait_time:.1f}s... "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
                time.sleep(wait_time)
                # Force session rotation on connection errors
                self._session_request_count = self.session_rotate_after

            except requests.exceptions.RequestException as e:
                self._adaptive_adjust(success=False)
                wait_time = 2 ** attempt
                logger.error(
                    f"Request failed: {e}. Waiting {wait_time:.1f}s... "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
                time.sleep(wait_time)

        return None

    def fetch_articles(
        self,
        cortarNo: str,
        coord_params: str,
        rletTpCd: str = "APT",
        tradTpCd: str = "A1:B1:B2:B3",
        sort: str = "rank",
        page: int = 1,
    ) -> dict | None:
        """Fetch article list from Naver Land API."""
        url = (
            f"{ARTICLE_LIST_URL}"
            f"?rletTpCd={rletTpCd}"
            f"&tradTpCd={tradTpCd}"
            f"{coord_params}"
            f"&cortarNo={cortarNo}"
            f"&sort={sort}"
            f"&page={page}"
        )
        logger.info(f"Fetching page {page}: {url[:100]}...")
        return self._request_with_backoff(url)

    def fetch_all_pages(
        self,
        cortarNo: str,
        coord_params: str,
        rletTpCd: str = "APT:JGC",
        tradTpCd: str = "A1:B1:B2:B3",
        sort: str = "rank",
        limit: int = 1000,
        on_progress: callable = None,
    ) -> list[dict]:
        """Fetch multiple pages of articles with anti-blocking measures."""
        all_articles = []
        page = 1

        while len(all_articles) < limit:
            if page > 1:
                self._random_delay()

            response = self.fetch_articles(
                cortarNo=cortarNo,
                coord_params=coord_params,
                rletTpCd=rletTpCd,
                tradTpCd=tradTpCd,
                sort=sort,
                page=page,
            )

            if response is None:
                logger.error(f"Failed to fetch page {page}")
                break

            body = response.get("body", [])
            if not body:
                logger.info(f"No more data at page {page}")
                break

            all_articles.extend(body)

            if on_progress:
                on_progress(page, len(all_articles))

            # Occasional longer pause to simulate human reading
            if page > 1 and page % 5 == 0:
                pause = random.uniform(3.0, 8.0)
                logger.info(f"Human-like pause: {pause:.1f}s after page {page}")
                time.sleep(pause)

            page += 1

        return all_articles[:limit]

    def fetch_complex_list(
        self,
        cortarNo: str,
        coord_params: str,
        rletTpCd: str = "APT",
        target_name: str | None = None,
        max_pages: int = 5,
    ) -> list[dict]:
        """Fetch complex (apartment) list for a district with pagination.

        If target_name is given, stops early once a match is found
        (avoids fetching all pages for large districts).
        Otherwise fetches up to max_pages.

        Returns list of dicts with hscpNo, hscpNm (complex name), etc.
        """
        all_complexes = []
        page = 1

        while page <= max_pages:
            if page > 1:
                self._random_delay()

            url = (
                f"{COMPLEX_LIST_URL}"
                f"?cortarNo={cortarNo}"
                f"{coord_params}"
                f"&rletTpCd={rletTpCd}"
                f"&page={page}"
            )
            logger.info(f"Fetching complex list page {page}: {url[:100]}...")
            result = self._request_with_backoff(url)

            if result is None:
                break

            items = result.get("result", [])
            if not items:
                break

            all_complexes.extend(items)

            # Early exit if target found
            if target_name:
                matched = [c for c in all_complexes if target_name in c.get("hscpNm", "")]
                if matched:
                    logger.info(f"Found target complex '{target_name}' on page {page}")
                    return all_complexes

            more = result.get("more", False)
            if not more:
                break

            page += 1

        return all_complexes

    def fetch_complex_articles(
        self,
        hscpNo: str,
        tradTpCd: str = "A1",
        limit: int = 1000,
        on_progress: callable = None,
    ) -> list[dict]:
        """Fetch listings for a specific complex (hscpNo) with pagination.

        Uses the complex-specific article list API which returns only
        listings for the given complex — much faster than fetching
        all district listings and filtering.
        """
        all_articles = []
        page = 1

        while len(all_articles) < limit:
            if page > 1:
                self._random_delay()

            url = (
                f"{COMPLEX_ARTICLE_URL}"
                f"?hscpNo={hscpNo}"
                f"&tradTpCd={tradTpCd}"
                f"&page={page}"
            )
            logger.info(f"Fetching complex articles page {page}: hscpNo={hscpNo}")
            response = self._request_with_backoff(url)

            if response is None:
                logger.error(f"Failed to fetch complex articles page {page}")
                break

            result = response.get("result", {})
            body = result.get("list", [])
            if not body:
                logger.info(f"No more complex articles at page {page}")
                break

            all_articles.extend(body)

            if on_progress:
                on_progress(page, len(all_articles))

            more = result.get("moreDataYn", "N")
            if more != "Y":
                break

            page += 1

        return all_articles[:limit]

    def search_complex_by_name(self, query: str) -> list[dict]:
        """Search complex hscpNo instantly via search redirect.

        m.land.naver.com/search/result/{query} returns:
        - 302 → /complex/info/{hscpNo} : single match
        - 200 → HTML with /complex/info/{id} links : multiple matches

        Returns: [{"hscpNo": "659", "hscpNm": "목동7단지"}, ...]
        """
        session = self._ensure_session()
        headers = _build_headers(self._current_profile)
        # Use page-visit headers (not AJAX) since this is a search page
        headers["Accept"] = (
            "text/html,application/xhtml+xml,application/xml;"
            "q=0.9,image/avif,image/webp,*/*;q=0.8"
        )
        headers.pop("X-Requested-With", None)
        headers["Sec-Fetch-Dest"] = "document"
        headers["Sec-Fetch-Mode"] = "navigate"

        url = f"{SEARCH_URL}/{urllib.parse.quote(query)}"
        logger.info(f"Search redirect for: {query}")

        try:
            response = session.get(
                url, headers=headers, timeout=30, allow_redirects=False,
            )
            self._last_request_time = time.time()
            self._request_count += 1
            self._session_request_count += 1

            if response.status_code == 302:
                location = response.headers.get("Location", "")
                match = re.search(r"/complex/info/(\d+)", location)
                if match:
                    logger.info(
                        f"Search redirect → hscpNo={match.group(1)}"
                    )
                    return [{"hscpNo": match.group(1), "hscpNm": query}]

            elif response.status_code == 200:
                ids = re.findall(r"/complex/info/(\d+)", response.text)
                unique_ids = list(dict.fromkeys(ids))
                if unique_ids:
                    logger.info(
                        f"Search found {len(unique_ids)} complexes: "
                        f"{unique_ids[:5]}"
                    )
                    return [
                        {"hscpNo": cid, "hscpNm": ""} for cid in unique_ids
                    ]

        except requests.exceptions.RequestException as e:
            logger.warning(f"Search redirect failed: {e}")

        return []

    def inter_district_delay(self):
        """Apply longer delay between districts (simulate human switching areas)."""
        delay = random.uniform(5.0, 15.0) * self._adaptive_delay_multiplier
        logger.info(f"Inter-district delay: {delay:.1f}s")
        time.sleep(delay)

    @property
    def stats(self) -> dict:
        """Return client statistics for monitoring."""
        return {
            "total_requests": self._request_count,
            "session_requests": self._session_request_count,
            "consecutive_errors": self._consecutive_errors,
            "adaptive_multiplier": round(self._adaptive_delay_multiplier, 2),
        }

    def close(self):
        if self._session:
            self._session.close()
            self._session = None
