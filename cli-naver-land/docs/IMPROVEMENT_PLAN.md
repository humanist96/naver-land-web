# cli-anything-naver-land 개선 기획서

> Claude Code에서 자연어로 네이버 부동산 매물을 정확하고 빠르게 검색하기 위한 개선 계획

## 현재 문제점 요약

| 분류 | 문제 | 심각도 |
|------|------|--------|
| 자연어 해석 | "종로 30평대 10억 이하 매매" 같은 한 줄 질의를 CLI 옵션으로 직접 변환해야 함 | CRITICAL |
| 지역 모호성 | "중구"가 서울/부산/대구 등 7개 도시에 존재하나 항상 서울로 해석 | CRITICAL |
| 성능 | 매 검색마다 API 클라이언트 새로 생성, 세션 재사용 없음 | HIGH |
| 필터 부족 | 날짜/태그/보증금 필터 없음 | HIGH |
| 출력 | 대량 결과 페이지네이션 없음, 마크다운/HTML 미지원 | MEDIUM |

---

## Phase 1: 자연어 쿼리 파싱 (핵심)

### 목표
Claude Code에서 사용자가 자연어로 질문하면 정확한 검색 결과를 바로 반환.

### 구현: `nlq.py` (Natural Language Query Parser)

**입력 예시 → 파싱 결과:**

```
"강남 30평대 매매 10억 이하"
→ district=강남구, size_type=30평대, trade=매매, max_price=10억

"부산 해운대 전세 84㎡ 이상"
→ city=부산시, district=해운대구, trade=전세, min_area=84

"경기 분당 래미안 매매 20층 이상"
→ city=경기도, district=분당구, complex=래미안, trade=매매, floor=20+

"서초구 반포자이 매매 제일 싼거"
→ district=서초구, complex=반포자이, trade=매매, sort=prc

"종로구 전체 매물 csv로 저장"
→ district=종로구, trade=all, export=csv
```

**파싱 전략:**

```python
# 1단계: 키워드 추출 (정규식 기반)
PRICE_PATTERN = r"(\d+억[\s]?[\d,]*만?|\d+만|\d+억)"
AREA_PATTERN = r"(\d+\.?\d*)\s*(?:㎡|평|제곱미터)"
FLOOR_PATTERN = r"(\d+)\s*층\s*(이상|이하|이내)"

# 2단계: 지역 매칭 (시/도 → 구/군 순차 탐색)
CITY_KEYWORDS = ["서울", "부산", "대구", "인천", ...]
TRADE_KEYWORDS = {"매매": "매매", "전세": "전세", "월세": "월세", "사다": "매매", "살": "매매"}
SIZE_KEYWORDS = {"소형": "소형", "20평": "20평대", "30평": "30평대", "대형": "중대형"}

# 3단계: 의도 판별
INTENT_EXPORT = ["저장", "다운", "csv", "json", "excel", "내보내기"]
INTENT_SORT = {"싼": "prc", "저렴": "prc", "최신": "date", "넓은": "spc", "큰": "spc"}
```

**핵심 함수:**

```python
@dataclass
class ParsedQuery:
    city_name: str | None        # "부산시"
    district_name: str | None    # "해운대구"
    complex_name: str | None     # "래미안"
    trade_types: list[str]       # ["매매"]
    property_type: str           # "APT:JGC"
    size_type: str | None        # "30평대"
    min_area: float | None
    max_area: float | None
    min_price: str | None        # "5억"
    max_price: str | None        # "15억"
    floor: str | None            # "20+"
    sort: str                    # "prc"
    limit: int                   # 1000
    export_format: str | None    # "csv"
    export_path: str | None      # "강남구_매매.csv"

def parse_natural_query(text: str) -> ParsedQuery:
    """자연어 → 구조화된 검색 쿼리"""
    ...
```

### Claude Code 연동 방식

Claude Code는 사용자 질문을 받아 Python 코드로 변환하여 실행합니다.
`parse_natural_query()`를 제공하면 Claude가 더 정확한 코드를 생성할 수 있습니다:

```python
# Claude Code가 생성하는 코드 패턴
from cli_anything.naver_land.nlq import parse_natural_query
from cli_anything.naver_land.core.search import search_region
from cli_anything.naver_land.core.filter import apply_filters

query = parse_natural_query("강남 30평대 매매 10억 이하")
listings = search_region(
    district_name=query.district_name,
    city_name=query.city_name,
    trade_types=query.trade_types,
)
filtered = apply_filters(listings, query.to_filter_criteria())
```

---

## Phase 2: 지역 모호성 해결

### 문제
"중구"는 서울·부산·대구·인천·대전·울산 6개 도시에 존재.
현재는 항상 서울 중구로 해석되어 다른 도시 사용자에게 잘못된 결과 반환.

### 해결책: 모호 지역 감지 + 명시적 확인

```python
def find_district_safe(name: str, city_name: str | None = None) -> District | list[District]:
    """모호한 지역명이면 후보 리스트 반환, 명확하면 단일 District 반환."""
    if city_name:
        return find_district(name, city_name=city_name)

    # 모든 로드된 지역에서 검색
    candidates = []
    for city_code in CITIES:
        districts = load_districts(city_code)
        match = _match_district(name, districts)
        if match:
            candidates.append(match)

    if len(candidates) == 1:
        return candidates[0]
    elif len(candidates) > 1:
        return candidates  # 호출자가 선택하도록
    return None
```

**CLI 동작:**
```
$ cli-anything-naver-land search region -d 중구 -t 매매

  ⚠ '중구'가 여러 도시에 있습니다:
    [1] 서울시 중구
    [2] 부산시 중구
    [3] 대구시 중구
    [4] 인천시 중구
    [5] 대전시 중구
    [6] 울산시 중구
  → -c 옵션으로 시/도를 지정하세요 (예: -c 부산)
```

---

## Phase 3: 성능 개선

### 3-1. API 클라이언트 싱글턴 + 세션 재사용

```python
# 현재: 매 검색마다 새 클라이언트 생성 → 쿠키/세션 낭비
client = NaverLandApiClient()  # search_region 내부, 매번 호출

# 개선: 모듈 레벨 싱글턴
_shared_client: NaverLandApiClient | None = None

def get_client() -> NaverLandApiClient:
    global _shared_client
    if _shared_client is None:
        _shared_client = NaverLandApiClient()
    return _shared_client
```

**효과:** REPL 모드에서 연속 검색 시 세션 쿠키 재사용, 초기화 시간 제거.

### 3-2. 검색 결과 인메모리 캐시

```python
from functools import lru_cache
from hashlib import md5

_result_cache: dict[str, tuple[float, list]] = {}  # key → (timestamp, results)
CACHE_TTL = 300  # 5분

def search_with_cache(cache_key: str, search_fn, *args, **kwargs):
    now = time.time()
    if cache_key in _result_cache:
        ts, results = _result_cache[cache_key]
        if now - ts < CACHE_TTL:
            return results
    results = search_fn(*args, **kwargs)
    _result_cache[cache_key] = (now, results)
    return results
```

**효과:** 같은 조건 재검색 시 API 호출 없이 즉시 반환 (5분 캐시).

### 3-3. 진행률 표시 개선

```python
# 현재: 페이지마다 한 줄씩 출력 → 30페이지면 30줄 스팸
# 개선: 한 줄 업데이트 (carriage return)
def on_progress(page, total):
    if not _json_output:
        click.echo(f"\r  수집 중... {total}건 (페이지 {page})", nl=False)

# 완료 후
click.echo(f"\r  수집 완료: {len(listings)}건" + " " * 20)
```

---

## Phase 4: 필터 확장

### 추가할 필터 목록

| 필터 | 옵션 | 예시 |
|------|------|------|
| 확인일 | `--since`, `--until` | `--since 2026-03-01` |
| 태그 | `--tag` | `--tag 역세권 --tag 신축` |
| 보증금 (월세) | `--min-deposit`, `--max-deposit` | `--min-deposit 1억` |
| 월세 | `--min-rent`, `--max-rent` | `--max-rent 100` (만원) |
| 단지명 포함 | `--name-contains` | `--name-contains 자이` |
| 건물 연식 | `--max-age` | `--max-age 10` (10년 이내) |

### 구현: FilterCriteria 확장

```python
@dataclass(frozen=True)
class FilterCriteria:
    # 기존
    size_type: str | None = None
    min_area: float | None = None
    max_area: float | None = None
    min_price: str | None = None
    max_price: str | None = None
    floor: str | None = None
    # 신규
    since_date: str | None = None      # "2026-03-01"
    until_date: str | None = None
    tags: list[str] | None = None      # ["역세권", "신축"]
    name_contains: str | None = None   # "래미안"
    min_rent: str | None = None        # 월세 최소
    max_rent: str | None = None        # 월세 최대
```

---

## Phase 5: 출력 개선

### 5-1. 테이블 페이지네이션

```python
def format_table(listings, page_size=30):
    """대량 결과를 page_size 단위로 나누어 출력."""
    total = len(listings)
    for i in range(0, total, page_size):
        chunk = listings[i:i+page_size]
        _render_table(chunk)
        if i + page_size < total:
            click.echo(f"\n  --- {i+page_size}/{total}건 표시 (Enter: 계속, q: 중단) ---")
            if click.getchar() == 'q':
                break
```

### 5-2. 결과 요약 통계

```python
def format_summary(listings, district_name):
    """검색 결과 핵심 통계."""
    prices = [parse_price(l.prc) for l in listings if l.prc]
    return {
        "총 매물": len(listings),
        "가격 범위": f"{min(prices):,}만 ~ {max(prices):,}만",
        "평균 가격": f"{sum(prices)//len(prices):,}만",
        "평형 분포": Counter(l.size_type for l in listings),
        "거래유형": Counter(l.trad_tp_nm for l in listings),
    }
```

**출력 예시:**
```
  종로구 매매 검색 결과
  ─────────────────────────
  총 매물:    576건
  가격 범위:  2억 3,000 ~ 85억
  평균 가격:  15억 4,200
  평형 분포:  소형 89건 | 20평대 201건 | 30평대 178건 | 중대형 108건
```

### 5-3. 네이버 매물 URL 자동 생성

```python
def listing_url(atcl_no: str) -> str:
    return f"https://m.land.naver.com/article/info/{atcl_no}"

def district_map_url(district: District, trade_type: str = "A1") -> str:
    lat = (district.btm + district.top) / 2
    lon = (district.lft + district.rgt) / 2
    return (
        f"https://m.land.naver.com/map/"
        f"{lat:.6f}:{lon:.6f}:{district.zoom}:"
        f"{district.cortarNo}/APT:JGC/{trade_type}"
    )
```

---

## Phase 6: 편의 기능

### 6-1. 즐겨찾기/프리셋

```python
# ~/.cli-anything-naver-land/presets.json
{
  "우리동네": {
    "city": "경기도",
    "district": "분당구",
    "trade_types": ["매매"],
    "size_type": "30평대"
  },
  "투자관심": {
    "city": "서울시",
    "district": "강남구",
    "trade_types": ["매매"],
    "max_price": "20억",
    "sort": "prc"
  }
}
```

사용: `cli-anything-naver-land search preset 우리동네`

### 6-2. 가격 변동 추적 (히스토리)

```python
# 이전 검색 결과와 비교하여 가격 변동 표시
# ~/.cli-anything-naver-land/history/종로구_매매_2026-03-13.json

def compare_with_previous(current, previous):
    """신규 매물, 가격 하락, 가격 상승, 삭제된 매물 감지."""
    current_map = {l.atcl_no: l for l in current}
    previous_map = {l.atcl_no: l for l in previous}

    new = [l for no, l in current_map.items() if no not in previous_map]
    removed = [l for no, l in previous_map.items() if no not in current_map]
    price_changed = [
        (current_map[no], previous_map[no])
        for no in current_map
        if no in previous_map and current_map[no].prc != previous_map[no].prc
    ]
    return new, removed, price_changed
```

---

## 구현 우선순위

| 순서 | Phase | 예상 효과 | 난이도 |
|------|-------|-----------|--------|
| 1 | Phase 2: 지역 모호성 해결 | 잘못된 결과 방지 | 낮음 |
| 2 | Phase 3-1: 클라이언트 싱글턴 | 연속 검색 속도 2배↑ | 낮음 |
| 3 | Phase 5-3: 매물 URL 생성 | 사용자 편의 | 낮음 |
| 4 | Phase 1: 자연어 파싱 | Claude Code 연동 핵심 | 중간 |
| 5 | Phase 4: 필터 확장 | 검색 정밀도 | 중간 |
| 6 | Phase 3-2: 결과 캐시 | 반복 검색 즉시 반환 | 낮음 |
| 7 | Phase 5-2: 요약 통계 | 시장 분석 | 낮음 |
| 8 | Phase 6: 프리셋/히스토리 | 반복 사용 편의 | 중간 |
| 9 | Phase 5-1: 페이지네이션 | 대량 결과 UX | 낮음 |

---

## 기대 효과

### Before (현재)
```
사용자: "부산 해운대 30평대 매매 10억 이하 알려줘"
Claude: python3 -m cli_anything.naver_land.naver_land_cli search region \
          -c 부산시 -d 해운대구 -t 매매 --type 30평대 --max-price 10억 --sort prc
```
→ 명령어 구성에 시간 소요, 옵션 오류 가능성

### After (개선 후)
```
사용자: "부산 해운대 30평대 매매 10억 이하 알려줘"
Claude:
  from cli_anything.naver_land.nlq import parse_natural_query
  q = parse_natural_query("부산 해운대 30평대 매매 10억 이하")
  results = search_and_filter(q)
  # → 즉시 정확한 결과 + 요약 통계 + 매물 URL
```
→ 자연어 직접 해석, 빠르고 정확한 결과
