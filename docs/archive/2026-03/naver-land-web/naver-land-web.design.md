# NaverLand Web Dashboard Design Document

> **Summary**: 네이버 부동산 매물 조회/분석/시각화 웹 대시보드 기술 설계서
>
> **Project**: NaverLand Web Dashboard
> **Version**: 1.0.0
> **Author**: AI-assisted
> **Date**: 2026-03-16
> **Status**: Draft
> **Planning Doc**: [naver-land-web.plan.md](../../01-plan/plan-naver-land-web.md)

---

## 1. Overview

### 1.1 Design Goals

1. CLI 엔진을 안정적으로 래핑하여 웹 API로 제공
2. 관리자 승인 기반 접근 제어로 책 구매자만 서비스 이용
3. Delta 수집으로 효율적 데이터 축적 및 시장 동향 시각화
4. 반응형 대시보드로 PC/모바일 모두 지원

### 1.2 Design Principles

- **Immutability**: 모든 데이터 객체는 불변으로 처리 (CLI와 동일 원칙)
- **Separation of Concerns**: CLI(수집) / API(비즈니스) / UI(표현) 분리
- **Progressive Enhancement**: P0 기능 우선 구현 후 P1/P2 점진 확장
- **Fail-Safe Collection**: 수집 실패 시 이전 데이터 보존, 부분 성공 허용

---

## 2. Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│  ┌────────────┐ ┌────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │ Auth Pages │ │ Search Page│ │ Dashboard   │ │ Admin Panel│  │
│  │ login      │ │ filters    │ │ charts      │ │ users mgmt │  │
│  │ signup     │ │ results    │ │ trends      │ │ collector  │  │
│  │ pending    │ │ export     │ │ stats cards │ │ settings   │  │
│  └─────┬──────┘ └─────┬──────┘ └──────┬──────┘ └─────┬──────┘  │
└────────┼───────────────┼───────────────┼──────────────┼─────────┘
         │               │               │              │
    ─────┼───────────────┼───────────────┼──────────────┼─────────
         │          TanStack Query (캐시 + 자동 리패치)  │
    ─────┼───────────────┼───────────────┼──────────────┼─────────
         ▼               ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js API Routes (Server)                    │
│                                                                  │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ /api/auth/*  │  │/api/search/*│  │ /api/dashboard/*     │   │
│  │ signup       │  │ region      │  │ overview             │   │
│  │ login        │  │ complex     │  │ price-trend          │   │
│  │ me           │  │ nlq         │  │ listing-changes      │   │
│  │ refresh      │  │ export      │  │ size-distribution    │   │
│  └──────┬───────┘  └──────┬──────┘  └───────────┬──────────┘   │
│         │                 │                      │              │
│  ┌──────┴───────┐  ┌──────┴──────┐  ┌───────────┴──────────┐   │
│  │/api/admin/*  │  │  CLI Bridge │  │ /api/collector/*     │   │
│  │ users        │  │ (subprocess)│  │ jobs                 │   │
│  │ approve      │  │ JSON parse  │  │ trigger              │   │
│  │ reject       │  │ error handle│  │ history              │   │
│  └──────┬───────┘  └──────┬──────┘  └───────────┬──────────┘   │
│         │                 │                      │              │
└─────────┼─────────────────┼──────────────────────┼──────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
   ┌────────────┐   ┌────────────────┐   ┌─────────────────────┐
   │ bkend.ai   │   │ CLI Engine    │   │ Cron Scheduler      │
   │ ─────────  │   │ (Python)      │   │ ───────────────     │
   │ Auth (JWT) │   │ naver_api.py  │   │ node-cron           │
   │ Users DB   │   │ search.py     │   │ → CLI subprocess    │
   │ Listings DB│   │ filter.py     │   │ → Delta detect      │
   │ Changes DB │   │ nlq.py        │   │ → DB upsert         │
   │ Snapshots  │   │ anti-blocking │   │ → Stats aggregate   │
   │ RLS Policies│  └───────┬───────┘   └──────────┬──────────┘
   └────────────┘           │                      │
                            ▼                      │
                    ┌───────────────┐               │
                    │ Naver Land    │◀──────────────┘
                    │ m.land.naver  │
                    └───────────────┘
```

### 2.2 Data Flow

#### 실시간 검색 플로우
```
User Input → NLQ Parse → CLI subprocess → Naver API → JSON → Filter → Response → UI Table
```

#### 수집 플로우
```
Cron Trigger → Active Jobs Query → CLI Batch Execute → Delta Detect → DB Upsert → Stats Aggregate
```

#### 대시보드 플로우
```
User Select (지역/기간) → market_snapshots Query → Aggregate → Charts Render
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| Auth Pages | bkend.ai Auth API | 로그인/가입/토큰 관리 |
| Search Page | CLI Bridge | 매물 검색 실행 |
| Dashboard | market_snapshots DB | 집계 데이터 조회 |
| CLI Bridge | Python CLI + Naver API | 실시간 매물 조회 |
| Collector | CLI Bridge + bkend.ai DB | 주기적 수집 + 저장 |
| Admin Panel | bkend.ai DB + Auth | 사용자/수집 관리 |

---

## 3. Data Model

### 3.1 Entity Definitions

#### User (bkend.ai 내장 + 확장)

```typescript
interface User {
  id: string
  email: string
  name: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  role: 'user' | 'admin'
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
  updatedAt: string
}
```

#### Listing (매물 스냅샷)

```typescript
interface Listing {
  id: string
  atclNo: string              // 네이버 매물번호
  atclNm: string              // 단지명
  districtCode: string        // 구 코드 (cortarNo)
  districtName: string        // "강남구"
  cityName: string            // "서울시"
  tradeType: string           // "매매" | "전세" | "월세"
  propertyType: string        // "아파트" | "빌라/연립" | "오피스텔"
  exclusiveArea: number       // 전용면적 (㎡)
  supplyArea: number          // 공급면적 (㎡)
  pyeong: number              // 평형 (환산)
  sizeType: string            // "소형" | "20평대" | "30평대" | "중대형"
  price: number               // 가격 (만원 단위, 정규화)
  priceDisplay: string        // 표시용 "8억 5,000"
  rentPrice: number | null    // 월세 (만원)
  floorInfo: string | null    // "10/25"
  confirmDate: string | null  // "20260316"
  tags: string[]              // ["역세권", "신축"]
  lat: number
  lng: number
  naverUrl: string            // 네이버 매물 링크
  collectedAt: string         // 수집 시각 (ISO)
  snapshotId: string          // 수집 배치 ID
}
```

#### ListingChange (변경 이력)

```typescript
interface ListingChange {
  id: string
  atclNo: string
  atclNm: string              // 단지명 (조회 편의)
  changeType: 'new' | 'removed' | 'price_up' | 'price_down'
  oldPrice: number | null
  newPrice: number | null
  priceDiff: number | null    // 가격 변동액 (만원)
  priceDiffPercent: number | null // 변동률 (%)
  oldRent: number | null
  newRent: number | null
  districtCode: string
  districtName: string
  tradeType: string
  detectedAt: string          // 감지 시각
  snapshotId: string
}
```

#### CollectionJob (수집 작업)

```typescript
interface CollectionJob {
  id: string
  districtCode: string
  districtName: string
  cityName: string
  tradeTypes: string[]        // ["매매", "전세"]
  propertyTypes: string[]     // ["APT", "JGC"]
  schedule: string            // cron expression "0 */6 * * *"
  isActive: boolean
  lastRunAt: string | null
  lastStatus: 'success' | 'failed' | 'running' | null
  lastError: string | null
  totalCount: number | null
  changeCount: number | null
  createdBy: string           // admin user id
  createdAt: string
}
```

#### MarketSnapshot (시장 요약)

```typescript
interface MarketSnapshot {
  id: string
  districtCode: string
  districtName: string
  snapshotDate: string        // "2026-03-16"
  tradeType: string           // "매매" | "전세" | "월세"
  totalCount: number
  avgPrice: number            // 평균가 (만원)
  medianPrice: number         // 중앙값 (만원)
  minPrice: number
  maxPrice: number
  sizeDistribution: {         // 평형별 분포
    small: number             // 소형
    twenty: number            // 20평대
    thirty: number            // 30평대
    large: number             // 중대형
  }
  newCount: number            // 신규 매물 수
  removedCount: number        // 삭제 매물 수
  priceUpCount: number        // 가격 상승 매물
  priceDownCount: number      // 가격 하락 매물
  snapshotId: string
  createdAt: string
}
```

#### SavedSearch (즐겨찾기)

```typescript
interface SavedSearch {
  id: string
  userId: string
  name: string                // "강남 30평대 매매"
  queryParams: {
    cityName?: string
    districtName?: string
    complexName?: string
    tradeTypes?: string[]
    sizeType?: string
    minPrice?: number
    maxPrice?: number
    sort?: string
    nlqText?: string          // 원본 자연어 쿼리
  }
  createdAt: string
}
```

### 3.2 Entity Relationships

```
[User] 1 ──── N [SavedSearch]
  │
  │ (admin)
  └──── manages ──── N [CollectionJob]

[CollectionJob] 1 ──── N [Listing] (via districtCode + snapshotId)
                  ──── N [ListingChange] (via snapshotId)
                  ──── N [MarketSnapshot] (via districtCode + date)

[Listing] ◀── delta compare ──▶ [ListingChange]
    │
    └── aggregated into ──▶ [MarketSnapshot]
```

### 3.3 bkend.ai Table Schema

#### users (확장 필드)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| name | string | yes | - | 사용자 이름 |
| status | string | yes | "pending" | pending/approved/rejected/suspended |
| role | string | yes | "user" | user/admin |
| approvedAt | string | no | null | 승인 시각 |
| approvedBy | string | no | null | 승인 관리자 ID |

#### listings

| Field | Type | Required | Index | Description |
|-------|------|----------|-------|-------------|
| atclNo | string | yes | yes | 네이버 매물번호 |
| atclNm | string | yes | - | 단지명 |
| districtCode | string | yes | yes | 구 코드 |
| districtName | string | yes | - | 구 이름 |
| cityName | string | yes | - | 시/도 이름 |
| tradeType | string | yes | yes | 거래유형 |
| propertyType | string | yes | - | 매물유형 |
| exclusiveArea | number | yes | - | 전용면적 (㎡) |
| supplyArea | number | yes | - | 공급면적 (㎡) |
| pyeong | number | yes | - | 평형 |
| sizeType | string | yes | yes | 평형분류 |
| price | number | yes | yes | 가격 (만원) |
| priceDisplay | string | yes | - | 표시용 가격 |
| rentPrice | number | no | - | 월세 (만원) |
| floorInfo | string | no | - | 층 정보 |
| confirmDate | string | no | - | 확인일 |
| tags | json | no | - | 태그 배열 |
| lat | number | yes | - | 위도 |
| lng | number | yes | - | 경도 |
| naverUrl | string | yes | - | 매물 링크 |
| collectedAt | string | yes | yes | 수집 시각 |
| snapshotId | string | yes | yes | 배치 ID |

#### listing_changes

| Field | Type | Required | Index | Description |
|-------|------|----------|-------|-------------|
| atclNo | string | yes | yes | 매물번호 |
| atclNm | string | yes | - | 단지명 |
| changeType | string | yes | yes | new/removed/price_up/price_down |
| oldPrice | number | no | - | 이전 가격 |
| newPrice | number | no | - | 현재 가격 |
| priceDiff | number | no | - | 변동액 |
| priceDiffPercent | number | no | - | 변동률 |
| districtCode | string | yes | yes | 구 코드 |
| districtName | string | yes | - | 구 이름 |
| tradeType | string | yes | - | 거래유형 |
| detectedAt | string | yes | yes | 감지 시각 |
| snapshotId | string | yes | yes | 배치 ID |

#### collection_jobs

| Field | Type | Required | Index | Description |
|-------|------|----------|-------|-------------|
| districtCode | string | yes | yes | 구 코드 |
| districtName | string | yes | - | 구 이름 |
| cityName | string | yes | - | 시 이름 |
| tradeTypes | json | yes | - | 거래유형 배열 |
| propertyTypes | json | yes | - | 매물유형 배열 |
| schedule | string | yes | - | cron expression |
| isActive | boolean | yes | yes | 활성 여부 |
| lastRunAt | string | no | - | 마지막 실행 |
| lastStatus | string | no | - | 마지막 상태 |
| lastError | string | no | - | 에러 메시지 |
| totalCount | number | no | - | 총 매물 수 |
| changeCount | number | no | - | 변경 건수 |

#### market_snapshots

| Field | Type | Required | Index | Description |
|-------|------|----------|-------|-------------|
| districtCode | string | yes | yes | 구 코드 |
| districtName | string | yes | - | 구 이름 |
| snapshotDate | string | yes | yes | 날짜 (YYYY-MM-DD) |
| tradeType | string | yes | yes | 거래유형 |
| totalCount | number | yes | - | 총 매물 수 |
| avgPrice | number | yes | - | 평균가 |
| medianPrice | number | yes | - | 중앙값 |
| minPrice | number | yes | - | 최저가 |
| maxPrice | number | yes | - | 최고가 |
| sizeDistribution | json | yes | - | 평형 분포 |
| newCount | number | yes | - | 신규 매물 |
| removedCount | number | yes | - | 삭제 매물 |
| priceUpCount | number | yes | - | 가격 상승 |
| priceDownCount | number | yes | - | 가격 하락 |
| snapshotId | string | yes | yes | 배치 ID |

#### saved_searches

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | 검색 이름 |
| queryParams | json | yes | 검색 조건 JSON |

---

## 4. API Specification

### 4.1 Endpoint List

#### Auth API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/signup` | 회원가입 | Public |
| POST | `/api/auth/login` | 로그인 (JWT 발급) | Public |
| GET | `/api/auth/me` | 내 정보 조회 | Required |
| POST | `/api/auth/refresh` | 토큰 갱신 | Refresh Token |
| POST | `/api/auth/logout` | 로그아웃 | Required |

#### Search API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/search/region` | 지역별 매물 검색 | Approved |
| GET | `/api/search/complex` | 단지별 매물 검색 | Approved |
| POST | `/api/search/nlq` | 자연어 검색 | Approved |
| GET | `/api/search/cities` | 시/도 목록 | Approved |
| GET | `/api/search/districts` | 구/군 목록 | Approved |
| GET | `/api/search/export` | 검색 결과 내보내기 | Approved |

#### Dashboard API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/dashboard/overview` | 시장 개요 (카드 데이터) | Approved |
| GET | `/api/dashboard/price-trend` | 가격 추이 | Approved |
| GET | `/api/dashboard/listing-changes` | 매물 증감 | Approved |
| GET | `/api/dashboard/size-distribution` | 평형 분포 | Approved |
| GET | `/api/dashboard/trade-comparison` | 거래유형 비교 | Approved |
| GET | `/api/dashboard/recent-changes` | 최근 변동 매물 | Approved |

#### Admin API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/admin/users` | 사용자 목록 | Admin |
| PATCH | `/api/admin/users/:id/approve` | 사용자 승인 | Admin |
| PATCH | `/api/admin/users/:id/reject` | 사용자 거부 | Admin |
| PATCH | `/api/admin/users/:id/suspend` | 사용자 정지 | Admin |

#### Collector API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/collector/jobs` | 수집 작업 목록 | Admin |
| POST | `/api/collector/jobs` | 수집 작업 생성 | Admin |
| PATCH | `/api/collector/jobs/:id` | 수집 작업 수정 | Admin |
| DELETE | `/api/collector/jobs/:id` | 수집 작업 삭제 | Admin |
| POST | `/api/collector/jobs/:id/trigger` | 수동 수집 트리거 | Admin |
| GET | `/api/collector/history` | 수집 이력 | Admin |

#### SavedSearch API (bkend.ai auto-generated CRUD)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/saved-searches` | 내 즐겨찾기 목록 | Approved |
| POST | `/api/saved-searches` | 즐겨찾기 저장 | Approved |
| DELETE | `/api/saved-searches/:id` | 즐겨찾기 삭제 | Approved |

### 4.2 Detailed Specification

#### `POST /api/auth/signup`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "name": "홍길동"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "홍길동",
    "status": "pending",
    "role": "user"
  },
  "message": "가입이 완료되었습니다. 관리자 승인 후 서비스를 이용할 수 있습니다."
}
```

#### `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": {
      "id": "user_abc123",
      "email": "user@example.com",
      "name": "홍길동",
      "status": "approved",
      "role": "user"
    }
  }
}
```

**Note:** `status: "pending"` 인 경우에도 로그인은 성공하지만, 클라이언트에서 `/pending` 페이지로 리다이렉트.

#### `GET /api/search/region`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| district | string | yes | 구/군 이름 ("강남구") |
| city | string | no | 시/도 이름 (모호한 경우) |
| tradeTypes | string | no | "매매,전세" (쉼표 구분) |
| propertyType | string | no | "APT:JGC" (기본값) |
| sort | string | no | "rank" (기본값) |
| limit | number | no | 1000 (기본값) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "listings": [
      {
        "atclNo": "2417835791",
        "atclNm": "래미안강남포레스트",
        "tradeType": "매매",
        "propertyType": "아파트",
        "exclusiveArea": 84.97,
        "supplyArea": 114.82,
        "pyeong": 34.7,
        "sizeType": "30평대",
        "price": 250000,
        "priceDisplay": "25억",
        "rentPrice": null,
        "floorInfo": "8/20",
        "confirmDate": "20260315",
        "tags": ["역세권", "신축"],
        "naverUrl": "https://m.land.naver.com/article/info/2417835791"
      }
    ],
    "meta": {
      "total": 247,
      "district": "강남구",
      "city": "서울시",
      "avgPrice": 82000,
      "avgPriceDisplay": "8.2억"
    }
  }
}
```

#### `POST /api/search/nlq`

**Request:**
```json
{
  "query": "강남 30평대 매매 10억 이하"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "parsed": {
      "districtName": "강남구",
      "cityName": "서울시",
      "tradeTypes": ["매매"],
      "sizeType": "30평대",
      "maxPrice": 100000,
      "sort": "rank"
    },
    "listings": [ ... ],
    "meta": { ... }
  }
}
```

#### `GET /api/dashboard/overview`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| districtCode | string | yes | 구 코드 |
| tradeType | string | no | "매매" (기본값) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "current": {
      "totalCount": 1247,
      "avgPrice": 82000,
      "avgPriceDisplay": "8.2억",
      "medianPrice": 78000,
      "newToday": 34,
      "removedToday": 12
    },
    "previous": {
      "totalCount": 1225,
      "avgPrice": 82400
    },
    "changes": {
      "countDiff": 22,
      "countDiffPercent": 1.8,
      "priceDiff": -400,
      "priceDiffPercent": -0.49
    }
  }
}
```

#### `GET /api/dashboard/price-trend`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| districtCode | string | yes | 구 코드 |
| period | string | no | "1w" / "1m" / "3m" / "6m" / "1y" |
| tradeTypes | string | no | "매매,전세" |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "labels": ["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15", "2026-03-16"],
    "datasets": [
      {
        "label": "매매",
        "data": [82400, 82200, 82100, 82300, 82000, 82100, 82000],
        "unit": "만원"
      },
      {
        "label": "전세",
        "data": [48000, 48100, 47900, 48000, 48200, 48100, 48000],
        "unit": "만원"
      }
    ]
  }
}
```

#### `GET /api/dashboard/recent-changes`

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| districtCode | string | yes | 구 코드 |
| changeType | string | no | "all" / "new" / "removed" / "price_up" / "price_down" |
| limit | number | no | 20 (기본값) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "changes": [
      {
        "atclNo": "2417835791",
        "atclNm": "래미안강남포레스트",
        "changeType": "price_down",
        "oldPrice": 260000,
        "newPrice": 250000,
        "priceDiff": -10000,
        "priceDiffPercent": -3.85,
        "priceDisplay": "25억 (▼1억)",
        "tradeType": "매매",
        "detectedAt": "2026-03-16T06:00:00Z"
      }
    ],
    "meta": {
      "total": 46,
      "new": 34,
      "removed": 12,
      "priceUp": 5,
      "priceDown": 8
    }
  }
}
```

#### `PATCH /api/admin/users/:id/approve`

**Request:** (empty body)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user_abc123",
    "status": "approved",
    "approvedAt": "2026-03-16T10:30:00Z",
    "approvedBy": "admin_xyz789"
  }
}
```

---

## 5. UI/UX Design

### 5.1 Page Structure & Routing

```
src/app/
├── (public)/                    # 공개 라우트 그룹
│   ├── page.tsx                 # / - 랜딩 페이지
│   ├── login/page.tsx           # /login
│   └── signup/page.tsx          # /signup
├── (auth)/                      # 인증 필요 라우트 그룹
│   ├── layout.tsx               # 승인 상태 체크 미들웨어
│   ├── pending/page.tsx         # /pending - 승인 대기
│   ├── search/page.tsx          # /search - 매물 검색
│   └── dashboard/page.tsx       # /dashboard - 대시보드
├── (admin)/                     # 관리자 전용 라우트 그룹
│   ├── layout.tsx               # admin 권한 체크
│   ├── admin/page.tsx           # /admin - 관리자 홈
│   ├── admin/users/page.tsx     # /admin/users - 사용자 관리
│   └── admin/collector/page.tsx # /admin/collector - 수집 관리
├── api/                         # API Routes
│   ├── auth/
│   ├── search/
│   ├── dashboard/
│   ├── admin/
│   └── collector/
└── layout.tsx                   # Root layout
```

### 5.2 User Flow

```
[방문] → [랜딩 페이지]
  │
  ├─ 회원가입 → [가입 폼] → [가입 완료] → [승인 대기 페이지]
  │                                            │
  │                                   관리자 승인 (비동기)
  │                                            │
  ├─ 로그인 → [로그인 폼] → status 체크
  │                           ├─ pending → [승인 대기 페이지]
  │                           ├─ rejected → [거부 안내]
  │                           ├─ approved → [검색 페이지] ◀─── 메인
  │                           └─ admin → [관리자 패널]
  │
  └─ 승인된 사용자 메인 플로우:
       ├─ [검색 페이지] → 자연어/필터 입력 → 결과 테이블 → 내보내기
       │                                        ↓
       │                                  네이버 링크 클릭
       │
       ├─ [대시보드] → 지역/기간 선택 → 차트 조회
       │    ├─ 시장 개요 카드 (총 매물, 평균가, 증감)
       │    ├─ 가격 추이 차트
       │    ├─ 매물 증감 차트
       │    ├─ 평형 분포
       │    └─ 최근 변동 매물 목록
       │
       └─ [관리자] → 사용자 승인/거부 + 수집 작업 관리
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `NavBar` | `src/components/layout/NavBar.tsx` | 상단 네비게이션, 로그인 상태 표시 |
| `AuthGuard` | `src/components/auth/AuthGuard.tsx` | 인증/승인 상태 체크 HOC |
| `LoginForm` | `src/components/auth/LoginForm.tsx` | 이메일/비밀번호 로그인 폼 |
| `SignupForm` | `src/components/auth/SignupForm.tsx` | 회원가입 폼 |
| `PendingNotice` | `src/components/auth/PendingNotice.tsx` | 승인 대기 안내 |
| `NlqSearchBar` | `src/components/search/NlqSearchBar.tsx` | 자연어 검색 입력바 |
| `FilterPanel` | `src/components/search/FilterPanel.tsx` | 필터 패널 (지역, 거래, 평형, 가격) |
| `ListingTable` | `src/components/search/ListingTable.tsx` | 매물 결과 테이블 (TanStack Table) |
| `ExportButtons` | `src/components/search/ExportButtons.tsx` | CSV/JSON/Excel 다운로드 버튼 |
| `SearchSummary` | `src/components/search/SearchSummary.tsx` | 검색 결과 요약 (건수, 평균가) |
| `OverviewCards` | `src/components/dashboard/OverviewCards.tsx` | 시장 개요 카드 4개 |
| `PriceTrendChart` | `src/components/dashboard/PriceTrendChart.tsx` | 가격 추이 Line Chart |
| `ListingChangeChart` | `src/components/dashboard/ListingChangeChart.tsx` | 매물 증감 Bar Chart |
| `SizeDistChart` | `src/components/dashboard/SizeDistChart.tsx` | 평형 분포 Donut Chart |
| `TradeCompareChart` | `src/components/dashboard/TradeCompareChart.tsx` | 거래유형 비교 Bar |
| `RecentChanges` | `src/components/dashboard/RecentChanges.tsx` | 최근 변동 매물 목록 |
| `DashboardFilter` | `src/components/dashboard/DashboardFilter.tsx` | 지역/기간 선택 필터 |
| `UserManageTable` | `src/components/admin/UserManageTable.tsx` | 사용자 목록 + 승인/거부 |
| `CollectorJobForm` | `src/components/admin/CollectorJobForm.tsx` | 수집 작업 생성/수정 |
| `CollectorJobList` | `src/components/admin/CollectorJobList.tsx` | 수집 작업 목록 |
| `CollectionHistory` | `src/components/admin/CollectionHistory.tsx` | 수집 이력 로그 |

---

## 6. Error Handling

### 6.1 Error Code Definition

| Code | Message | Cause | Handling |
|------|---------|-------|----------|
| 400 | 잘못된 요청입니다 | 입력 검증 실패 | 폼 에러 메시지 표시 |
| 401 | 인증이 필요합니다 | 토큰 만료/없음 | 로그인 페이지 리다이렉트 |
| 403 | 접근 권한이 없습니다 | 미승인/관리자 아님 | 권한 안내 페이지 |
| 404 | 찾을 수 없습니다 | 리소스 없음 | 404 페이지 |
| 429 | 요청이 너무 많습니다 | API Rate Limit | 재시도 안내 |
| 500 | 서버 오류 | 내부 에러 | 에러 페이지 + 로깅 |
| 503 | 수집 서비스 일시 중단 | CLI 실행 실패 | 캐시 데이터 폴백 |

### 6.2 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "APPROVAL_REQUIRED",
    "message": "관리자 승인 후 이용 가능합니다.",
    "details": {
      "status": "pending",
      "requestedAt": "2026-03-16T09:00:00Z"
    }
  }
}
```

### 6.3 CLI Bridge Error Handling

```typescript
// CLI 실행 에러 유형
type CliErrorType =
  | 'CLI_NOT_FOUND'       // Python/CLI 미설치
  | 'CLI_TIMEOUT'         // 30초 타임아웃
  | 'CLI_PARSE_ERROR'     // JSON 파싱 실패
  | 'NAVER_API_BLOCKED'   // 네이버 API 차단 (429/403)
  | 'NAVER_API_CHANGED'   // API 구조 변경
  | 'DISTRICT_NOT_FOUND'  // 잘못된 지역명
  | 'DISTRICT_AMBIGUOUS'  // 모호한 지역명 (중구 등)

// 에러별 폴백 전략
const errorFallbacks: Record<CliErrorType, () => void> = {
  CLI_TIMEOUT: () => returnCachedResults(),
  NAVER_API_BLOCKED: () => increaseDelay() && retryLater(),
  DISTRICT_AMBIGUOUS: () => returnCitySelectionOptions(),
}
```

---

## 7. Security Considerations

### 7.1 Authentication & Authorization

```typescript
// 미들웨어 체인
Request → verifyJWT → checkUserStatus → checkRole → Handler

// 상태별 접근 제어
const accessMatrix = {
  public: ['/', '/login', '/signup'],
  pending: ['/pending'],
  approved: ['/search', '/dashboard', '/api/search/*', '/api/dashboard/*'],
  admin: ['/admin/*', '/api/admin/*', '/api/collector/*'],
}
```

### 7.2 Security Checklist

- [x] JWT 기반 인증 (Access 1h, Refresh 7d)
- [x] 비밀번호 해싱 (bkend.ai 내장 bcrypt)
- [x] 역할 기반 접근 제어 (RBAC: user/admin)
- [x] 승인 상태 미들웨어 (pending 차단)
- [ ] 입력 검증 (Zod 스키마 전 엔드포인트)
- [ ] Rate Limiting (검색 API: 10req/min/user)
- [ ] CSRF 보호 (SameSite Cookie)
- [ ] XSS 방지 (React 기본 이스케이프 + DOMPurify)
- [ ] CLI Injection 방지 (subprocess 파라미터 화이트리스트)
- [ ] 환경변수 관리 (bkend API key 서버 전용)

### 7.3 CLI Injection Prevention

```typescript
// DANGEROUS: Shell injection 가능
exec(`python3 -m cli_anything.naver_land search region -d ${district}`)

// SAFE: execFile + 파라미터 배열
execFile('python3', [
  '-m', 'cli_anything.naver_land',
  'search', 'region',
  '-d', sanitizeDistrictName(district),  // 한글+숫자만 허용
  '--json',
], { timeout: 30000 })
```

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Coverage |
|------|--------|------|----------|
| Unit Test | API handlers, utils, delta detect | Vitest | 80%+ |
| Integration Test | API endpoints + bkend.ai | Vitest + fetch | 핵심 플로우 |
| E2E Test | 사용자 시나리오 | Playwright | 주요 경로 |

### 8.2 Test Cases (Key)

#### Auth
- [ ] 회원가입 → status = pending 확인
- [ ] pending 사용자 로그인 → /pending 리다이렉트
- [ ] approved 사용자 로그인 → /search 접근 가능
- [ ] rejected 사용자 로그인 → 거부 안내
- [ ] 관리자 승인 → status 변경 + approvedAt 기록
- [ ] 비관리자 admin API 접근 → 403

#### Search
- [ ] 지역 검색 → CLI 호출 → JSON 파싱 → 올바른 응답
- [ ] 자연어 검색 → NLQ 파싱 → 올바른 파라미터 변환
- [ ] 모호한 지역 → 도시 선택 옵션 반환
- [ ] CLI 타임아웃 → 에러 응답 (503)
- [ ] 빈 결과 → 빈 배열 + 적절한 메시지

#### Dashboard
- [ ] overview → 오늘 vs 어제 비교 데이터
- [ ] price-trend → 기간별 가격 배열
- [ ] 데이터 없는 기간 → 빈 차트 graceful 처리

#### Collector
- [ ] 수집 작업 생성 → DB 저장 확인
- [ ] Delta 감지 → 신규/삭제/가격변동 정확 분류
- [ ] 수집 실패 → lastStatus = "failed" + 에러 로그
- [ ] 동시 수집 방지 → running 상태 체크

---

## 9. Clean Architecture

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | UI 컴포넌트, 페이지, hooks | `src/components/`, `src/app/` |
| **Application** | 비즈니스 로직, 서비스 함수 | `src/services/` |
| **Domain** | 타입 정의, 상수, 핵심 로직 | `src/types/`, `src/domain/` |
| **Infrastructure** | API 클라이언트, CLI Bridge, DB | `src/lib/` |

### 9.2 Dependency Rules

```
Presentation ──→ Application ──→ Domain ←── Infrastructure
                      │
                      └──→ Infrastructure
```

### 9.3 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| Search/Dashboard Pages | Presentation | `src/app/(auth)/` |
| NavBar, FilterPanel, Charts | Presentation | `src/components/` |
| useSearch, useDashboard | Presentation | `src/hooks/` |
| searchService, collectorService | Application | `src/services/` |
| deltaDetector, statsAggregator | Application | `src/services/collector/` |
| Listing, MarketSnapshot types | Domain | `src/types/` |
| formatPrice, parseKoreanPrice | Domain | `src/domain/price.ts` |
| cliBridge (subprocess wrapper) | Infrastructure | `src/lib/cli-bridge.ts` |
| bkendClient (API wrapper) | Infrastructure | `src/lib/bkend.ts` |
| cronScheduler | Infrastructure | `src/lib/scheduler.ts` |

---

## 10. Coding Convention

### 10.1 Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| Components | PascalCase | `ListingTable`, `PriceTrendChart` |
| Hooks | camelCase, use- prefix | `useSearch`, `useDashboard` |
| Services | camelCase | `searchService`, `collectorService` |
| Types | PascalCase | `Listing`, `MarketSnapshot` |
| Constants | UPPER_SNAKE_CASE | `MAX_SEARCH_LIMIT`, `CACHE_TTL` |
| API Routes | kebab-case | `price-trend`, `listing-changes` |
| Files (component) | PascalCase.tsx | `ListingTable.tsx` |
| Files (utility) | camelCase.ts | `cliBridge.ts` |
| Folders | kebab-case | `search/`, `dashboard/` |

### 10.2 Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | Client | 앱 URL |
| `BKEND_API_URL` | Server | bkend.ai API URL |
| `BKEND_API_KEY` | Server | bkend.ai API 키 |
| `BKEND_PROJECT_ID` | Server | bkend.ai 프로젝트 ID |
| `CLI_PYTHON_PATH` | Server | Python 실행 경로 |
| `CLI_TIMEOUT_MS` | Server | CLI 타임아웃 (기본 30000) |
| `CRON_SECRET` | Server | Cron 인증 시크릿 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # 랜딩
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (auth)/
│   │   ├── layout.tsx                  # AuthGuard
│   │   ├── pending/page.tsx
│   │   ├── search/page.tsx
│   │   └── dashboard/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx                  # AdminGuard
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── users/page.tsx
│   │       └── collector/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── signup/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── me/route.ts
│   │   │   └── refresh/route.ts
│   │   ├── search/
│   │   │   ├── region/route.ts
│   │   │   ├── complex/route.ts
│   │   │   ├── nlq/route.ts
│   │   │   ├── cities/route.ts
│   │   │   ├── districts/route.ts
│   │   │   └── export/route.ts
│   │   ├── dashboard/
│   │   │   ├── overview/route.ts
│   │   │   ├── price-trend/route.ts
│   │   │   ├── listing-changes/route.ts
│   │   │   ├── size-distribution/route.ts
│   │   │   ├── trade-comparison/route.ts
│   │   │   └── recent-changes/route.ts
│   │   ├── admin/
│   │   │   └── users/
│   │   │       ├── route.ts
│   │   │       └── [id]/
│   │   │           ├── approve/route.ts
│   │   │           ├── reject/route.ts
│   │   │           └── suspend/route.ts
│   │   └── collector/
│   │       ├── jobs/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── trigger/route.ts
│   │       └── history/route.ts
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   └── NavBar.tsx
│   ├── ui/                             # shadcn/ui
│   ├── auth/
│   │   ├── AuthGuard.tsx
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── PendingNotice.tsx
│   ├── search/
│   │   ├── NlqSearchBar.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── ListingTable.tsx
│   │   ├── ExportButtons.tsx
│   │   └── SearchSummary.tsx
│   ├── dashboard/
│   │   ├── OverviewCards.tsx
│   │   ├── PriceTrendChart.tsx
│   │   ├── ListingChangeChart.tsx
│   │   ├── SizeDistChart.tsx
│   │   ├── TradeCompareChart.tsx
│   │   ├── RecentChanges.tsx
│   │   └── DashboardFilter.tsx
│   └── admin/
│       ├── UserManageTable.tsx
│       ├── CollectorJobForm.tsx
│       ├── CollectorJobList.tsx
│       └── CollectionHistory.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useSearch.ts
│   ├── useDashboard.ts
│   └── useAdmin.ts
├── services/
│   ├── authService.ts
│   ├── searchService.ts
│   ├── dashboardService.ts
│   ├── adminService.ts
│   └── collector/
│       ├── collectorService.ts
│       ├── deltaDetector.ts
│       └── statsAggregator.ts
├── types/
│   ├── listing.ts
│   ├── user.ts
│   ├── dashboard.ts
│   ├── collector.ts
│   └── api.ts
├── domain/
│   ├── price.ts                        # 가격 파싱/포맷
│   ├── district.ts                     # 지역 코드/이름 매핑
│   └── constants.ts                    # 상수 정의
├── lib/
│   ├── cli-bridge.ts                   # CLI subprocess 래퍼
│   ├── bkend.ts                        # bkend.ai API 클라이언트
│   ├── scheduler.ts                    # Cron 스케줄러
│   ├── auth-middleware.ts              # JWT 검증 미들웨어
│   └── validators.ts                   # Zod 스키마 검증
└── styles/
    └── globals.css                     # Tailwind + 커스텀
```

### 11.2 Implementation Order

#### Phase 1: 프로젝트 초기화 & 인증 (P0)
1. [x] Next.js 15 프로젝트 생성 + shadcn/ui + Tailwind
2. [ ] `src/types/` - 타입 정의 (User, Listing, etc.)
3. [ ] `src/domain/` - 핵심 도메인 로직 (price.ts, district.ts)
4. [ ] `src/lib/bkend.ts` - bkend.ai 클라이언트
5. [ ] `src/lib/auth-middleware.ts` - JWT 미들웨어
6. [ ] `src/app/api/auth/*` - 인증 API 엔드포인트
7. [ ] `src/components/auth/*` - 인증 UI 컴포넌트
8. [ ] `src/app/(public)/*` - 공개 페이지 (랜딩, 로그인, 가입)
9. [ ] `src/app/(auth)/pending/` - 승인 대기 페이지
10. [ ] `src/components/layout/NavBar.tsx` - 네비게이션

#### Phase 2: CLI 연동 & 검색 (P0)
11. [ ] CLI 설치 검증 (`pip install -e ./cli-naver-land`)
12. [ ] `src/lib/cli-bridge.ts` - CLI subprocess 래퍼
13. [ ] `src/services/searchService.ts` - 검색 비즈니스 로직
14. [ ] `src/app/api/search/*` - 검색 API 엔드포인트
15. [ ] `src/components/search/*` - 검색 UI 컴포넌트
16. [ ] `src/hooks/useSearch.ts` - 검색 클라이언트 훅
17. [ ] `src/app/(auth)/search/page.tsx` - 검색 페이지

#### Phase 3: 데이터 수집 (P0)
18. [ ] bkend.ai 테이블 생성 (listings, listing_changes, collection_jobs, market_snapshots)
19. [ ] `src/services/collector/deltaDetector.ts` - Delta 감지 로직
20. [ ] `src/services/collector/statsAggregator.ts` - 통계 집계
21. [ ] `src/services/collector/collectorService.ts` - 수집 오케스트레이션
22. [ ] `src/lib/scheduler.ts` - Cron 스케줄러
23. [ ] `src/app/api/collector/*` - 수집 API
24. [ ] `src/components/admin/Collector*` - 수집 관리 UI
25. [ ] `src/app/(admin)/admin/collector/page.tsx` - 수집 관리 페이지

#### Phase 4: 대시보드 & 시각화 (P0)
26. [ ] `src/services/dashboardService.ts` - 대시보드 데이터 서비스
27. [ ] `src/app/api/dashboard/*` - 대시보드 API
28. [ ] `src/components/dashboard/OverviewCards.tsx` - 시장 개요 카드
29. [ ] `src/components/dashboard/PriceTrendChart.tsx` - 가격 추이 차트
30. [ ] `src/components/dashboard/ListingChangeChart.tsx` - 매물 증감 차트
31. [ ] `src/components/dashboard/SizeDistChart.tsx` - 평형 분포 차트
32. [ ] `src/components/dashboard/TradeCompareChart.tsx` - 거래유형 비교
33. [ ] `src/components/dashboard/RecentChanges.tsx` - 최근 변동 목록
34. [ ] `src/hooks/useDashboard.ts` - 대시보드 훅
35. [ ] `src/app/(auth)/dashboard/page.tsx` - 대시보드 페이지

#### Phase 5: 관리자 & 배포 (P0)
36. [ ] `src/components/admin/UserManageTable.tsx` - 사용자 관리
37. [ ] `src/app/(admin)/admin/users/page.tsx` - 사용자 관리 페이지
38. [ ] 보안 점검 + 입력 검증
39. [ ] 반응형 UI 검증
40. [ ] Vercel 배포 + 환경변수

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-16 | Initial draft | AI-assisted |
