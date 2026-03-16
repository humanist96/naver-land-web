# Plan: 네이버 부동산 매물 조회 웹서비스

- **프로젝트명:** NaverLand Web Dashboard
- **레벨:** Dynamic (bkend.ai BaaS + Next.js)
- **작성일:** 2026-03-16
- **상태:** Draft

---

## 1. 프로젝트 개요

### 1.1 목표
`cli-anything-naver-land` CLI 도구를 기반으로, 네이버 부동산 매물을 **웹 대시보드**에서 조회/분석/시각화할 수 있는 서비스를 구축한다.

### 1.2 핵심 가치
- **접근성:** CLI 사용이 어려운 책 구매자도 웹에서 손쉽게 매물 검색
- **분석력:** 가격 변동 추이, 시장 동향을 대시보드로 시각화
- **자동화:** 변경분만 주기적으로 수집하여 실시간에 가까운 데이터 제공
- **보안:** 책 구매 인증 + 관리자 승인 기반 접근 제어

### 1.3 사용자
| 역할 | 설명 | 권한 |
|------|------|------|
| 비인증 사용자 | 회원가입만 가능 | 가입, 승인 대기 화면 |
| 승인 대기 사용자 | 가입 완료, 관리자 승인 대기 | 대기 안내 페이지 |
| 일반 사용자 | 관리자가 승인한 책 구매자 | 매물 검색, 필터, 내보내기, 대시보드 열람 |
| 관리자 | 서비스 운영자 | 사용자 승인/거부, 수집 관리, 시스템 설정 |

---

## 2. 기능 요구사항

### 2.1 인증 & 인가 (Auth)

| ID | 기능 | 설명 | 우선순위 |
|----|------|------|---------|
| AUTH-01 | 이메일 회원가입 | 이메일 + 비밀번호 기반 가입 | P0 |
| AUTH-02 | 이메일 로그인 | JWT 기반 인증 (Access 1h, Refresh 7d) | P0 |
| AUTH-03 | 관리자 승인 플로우 | 가입 후 `pending` → 관리자가 `approved`로 변경해야 서비스 이용 | P0 |
| AUTH-04 | 관리자 대시보드 | 사용자 목록, 승인/거부/정지 관리 | P0 |
| AUTH-05 | 승인 대기 안내 | 미승인 사용자에게 대기 화면 표시 | P0 |
| AUTH-06 | 이메일 알림 | 승인/거부 시 사용자에게 이메일 발송 | P1 |
| AUTH-07 | 비밀번호 재설정 | 이메일 기반 비밀번호 찾기 | P1 |

### 2.2 매물 검색 (Search)

| ID | 기능 | 설명 | 우선순위 |
|----|------|------|---------|
| SRCH-01 | 지역별 검색 | 시/도 → 구/군 선택 후 매물 조회 (CLI의 `search region`) | P0 |
| SRCH-02 | 단지별 검색 | 아파트 단지명으로 검색 (CLI의 `search complex`) | P0 |
| SRCH-03 | 자연어 검색 | 한글 자연어 입력으로 검색 (CLI의 `nlq`) | P0 |
| SRCH-04 | 다중 필터 | 평형, 가격, 층수, 날짜, 태그, 거래유형, 매물유형 | P0 |
| SRCH-05 | 정렬 | 추천순, 가격순, 면적순, 최신순 | P0 |
| SRCH-06 | 결과 테이블 | 페이지네이션, 컬럼 정렬, 행 클릭 시 상세 | P0 |
| SRCH-07 | 내보내기 | CSV, JSON, Excel 다운로드 | P1 |
| SRCH-08 | 네이버 링크 | 매물별 네이버 부동산 직접 링크 | P0 |
| SRCH-09 | 즐겨찾기 | 자주 쓰는 검색 조건 저장/불러오기 | P2 |
| SRCH-10 | 지도 뷰 | 지도 위에 매물 마커 표시 (Naver Map API) | P2 |

### 2.3 데이터 수집 & 스케줄링 (Collector)

| ID | 기능 | 설명 | 우선순위 |
|----|------|------|---------|
| COLL-01 | 주기적 수집 | 지정 지역의 매물을 주기적으로 수집 (cron 기반) | P0 |
| COLL-02 | 변경분 감지 (Delta) | 이전 수집 대비 변경된 매물만 저장 (신규/삭제/가격변동) | P0 |
| COLL-03 | 수집 대상 관리 | 관리자가 수집 지역/거래유형/주기 설정 | P0 |
| COLL-04 | 수집 이력 | 수집 시각, 건수, 변경 건수 로그 | P1 |
| COLL-05 | 수집 상태 모니터링 | 마지막 수집 시각, 성공/실패 상태 표시 | P1 |

### 2.4 대시보드 & 시각화 (Dashboard)

| ID | 기능 | 설명 | 우선순위 |
|----|------|------|---------|
| DASH-01 | 시장 개요 카드 | 총 매물수, 평균가, 전일 대비 변동 | P0 |
| DASH-02 | 가격 추이 차트 | 지역별/평형별 가격 변동 추이 (Line Chart) | P0 |
| DASH-03 | 매물 증감 차트 | 일별 신규/삭제 매물 수 (Bar Chart) | P0 |
| DASH-04 | 평형별 분포 | 소형/20평대/30평대/중대형 매물 분포 (Pie/Donut) | P1 |
| DASH-05 | 거래유형 비교 | 매매/전세/월세 가격 비교 (Grouped Bar) | P1 |
| DASH-06 | 지역 히트맵 | 지역별 매물 밀집도/가격 수준 시각화 | P2 |
| DASH-07 | 가격 변동 알림 | 관심 지역 가격 변동 시 알림 (in-app) | P2 |
| DASH-08 | 리포트 생성 | 주간/월간 시장 동향 리포트 PDF 다운로드 | P2 |

---

## 3. CLI 기능 개선 목록

CLI를 웹서비스의 데이터 수집 엔진으로 활용하기 위해 다음 개선이 필요합니다.

### 3.1 필수 개선 (P0 - 웹서비스 연동에 필수)

| ID | 현재 상태 | 개선 내용 | 이유 |
|----|----------|----------|------|
| CLI-01 | 결과가 터미널 출력 전용 | **JSON stdout 모드 강화** | 웹 API에서 subprocess로 호출 시 구조화된 JSON 필요 |
| CLI-02 | 단일 지역 검색만 가능 | **다중 지역 배치 검색** | 수집기가 여러 지역을 한번에 수집해야 함 |
| CLI-03 | 캐시가 메모리 전용 (5분) | **파일/DB 기반 영속 캐시** | 수집 데이터를 DB에 저장하여 변경분 비교 |
| CLI-04 | 변경분 감지 없음 | **Delta Detection 모듈** | 이전 수집 대비 신규/삭제/가격변동 매물 식별 |
| CLI-05 | 가격이 문자열 ("8억 5,000") | **정규화된 숫자 가격 필드 추가** | DB 저장/비교/정렬/차트에 숫자 필요 |
| CLI-06 | exit 코드 미정의 | **표준 exit 코드 + 에러 JSON** | 웹 API에서 성공/실패 판별 필요 |

### 3.2 권장 개선 (P1 - 서비스 품질 향상)

| ID | 현재 상태 | 개선 내용 | 이유 |
|----|----------|----------|------|
| CLI-07 | 보증금 필터 없음 | **월세 보증금 필터 추가** (`--min-deposit`, `--max-deposit`) | 월세 검색 시 보증금 범위 필수 |
| CLI-08 | 건축년도 정보 미수집 | **건축년도/세대수 필드 추가** | 매물 상세 정보 강화 |
| CLI-09 | 대량 결과 페이지네이션 없음 | **커서 기반 페이지네이션** | 1000건+ 결과 안정적 처리 |
| CLI-10 | 에러 시 stderr 텍스트만 | **구조화된 에러 응답** (JSON) | 웹 API에서 에러 유형별 핸들링 |
| CLI-11 | 검색 결과에 매물 URL 없음 | **매물 상세 URL 자동 생성** | 웹에서 네이버 부동산 링크 제공 |
| CLI-12 | NLQ가 CLI 내부에서만 동작 | **NLQ 파서 라이브러리화** | 웹 API에서 직접 import 가능하게 |

### 3.3 추가 개선 (P2 - 차별화)

| ID | 현재 상태 | 개선 내용 | 이유 |
|----|----------|----------|------|
| CLI-13 | 동기 단일스레드 | **비동기(asyncio) 지원** | 다중 지역 병렬 수집으로 속도 10배 향상 |
| CLI-14 | Anti-blocking만 있음 | **Proxy 풀 지원** | 대규모 수집 시 IP 분산 |
| CLI-15 | API 응답 raw 저장 없음 | **Raw 응답 아카이브** | 원본 데이터 보존, 파싱 로직 변경 시 재처리 |
| CLI-16 | 아파트+재건축만 기본 | **오피스텔/빌라/원룸 기본 포함** | 다양한 매물 유형 검색 요구 |
| CLI-17 | 통계 요약이 텍스트만 | **통계 JSON 출력** | 대시보드 카드에 직접 활용 |

---

## 4. 기술 스택

### 4.1 프론트엔드
| 항목 | 기술 | 이유 |
|------|------|------|
| 프레임워크 | **Next.js 15 (App Router)** | SSR/SSG, API Routes, 최적 SEO |
| UI 라이브러리 | **shadcn/ui + Tailwind CSS** | 빠른 개발, 커스터마이징 용이 |
| 차트 | **Recharts** | React 네이티브, 반응형, 경량 |
| 상태관리 | **TanStack Query (React Query)** | 서버 상태 캐싱, 자동 리패치 |
| 폼 | **React Hook Form + Zod** | 타입 안전한 폼 검증 |
| 테이블 | **TanStack Table** | 정렬, 필터, 페이지네이션 |

### 4.2 백엔드 & 인프라
| 항목 | 기술 | 이유 |
|------|------|------|
| BaaS | **bkend.ai** | 인증, DB, API 자동 생성 |
| API Layer | **Next.js API Routes** | CLI 래핑, 비즈니스 로직 |
| 수집 엔진 | **CLI (Python subprocess)** | 기존 CLI 재활용, anti-blocking 활용 |
| 스케줄러 | **node-cron / Vercel Cron** | 주기적 데이터 수집 |
| 배포 | **Vercel** | Next.js 최적화 배포 |

### 4.3 데이터 모델 (bkend.ai)

```
users (bkend 내장)
├── email: string
├── password: hash
├── status: enum [pending, approved, rejected, suspended]
├── role: enum [user, admin]
├── approved_at: timestamp?
├── approved_by: string?
└── created_at: timestamp

listings (매물 스냅샷)
├── id: auto
├── atcl_no: string (네이버 매물번호, unique per snapshot)
├── atcl_nm: string (단지명)
├── district_code: string (구 코드)
├── district_name: string (구 이름)
├── city_name: string (시/도 이름)
├── trade_type: string (매매/전세/월세)
├── property_type: string (아파트/빌라/오피스텔)
├── exclusive_area: float (전용면적 ㎡)
├── supply_area: float (공급면적 ㎡)
├── pyeong: float (평형)
├── size_type: string (소형/20평대/30평대/중대형)
├── price: integer (가격, 만원 단위)
├── price_display: string (표시용 "8억 5,000")
├── rent_price: integer? (월세, 만원)
├── floor_info: string? ("10/25")
├── confirm_date: string? (매물 확인일)
├── tags: json (["역세권", "신축"])
├── lat: float
├── lng: float
├── naver_url: string (네이버 매물 링크)
├── collected_at: timestamp (수집 시각)
└── snapshot_id: string (수집 배치 ID)

listing_changes (변경 이력)
├── id: auto
├── atcl_no: string
├── change_type: enum [new, removed, price_up, price_down]
├── old_price: integer?
├── new_price: integer?
├── old_rent: integer?
├── new_rent: integer?
├── district_code: string
├── detected_at: timestamp
└── snapshot_id: string

collection_jobs (수집 작업)
├── id: auto
├── district_code: string
├── district_name: string
├── trade_types: json
├── schedule: string (cron expression)
├── is_active: boolean
├── last_run_at: timestamp?
├── last_status: enum [success, failed, running]
├── total_count: integer?
├── change_count: integer?
└── created_by: string (admin user id)

saved_searches (즐겨찾기)
├── id: auto
├── user_id: string
├── name: string
├── query_params: json
└── created_at: timestamp

market_snapshots (시장 요약 - 대시보드용)
├── id: auto
├── district_code: string
├── snapshot_date: date
├── trade_type: string
├── total_count: integer
├── avg_price: integer
├── median_price: integer
├── min_price: integer
├── max_price: integer
├── size_distribution: json ({소형: 10, 20평대: 25, ...})
├── new_count: integer (신규 매물)
├── removed_count: integer (삭제 매물)
└── created_at: timestamp
```

---

## 5. 아키텍처 개요

```
┌─ 사용자 (브라우저) ─────────────────────────────────────────┐
│  Next.js App (SSR)                                          │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ 로그인   │ │ 검색     │ │ 대시보드  │ │ 관리자 패널  │  │
│  │ 회원가입 │ │ 필터     │ │ 차트/통계 │ │ 사용자 관리  │  │
│  │ 승인대기 │ │ 내보내기 │ │ 동향분석  │ │ 수집 설정    │  │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └──────┬───────┘  │
└───────┼────────────┼─────────────┼───────────────┼──────────┘
        │            │             │               │
        ▼            ▼             ▼               ▼
┌─ Next.js API Routes ───────────────────────────────────────┐
│  /api/auth/*     /api/search/*   /api/dashboard/*           │
│  /api/admin/*    /api/export/*   /api/collector/*            │
└────┬──────────────┬──────────────┬──────────────────────────┘
     │              │              │
     ▼              │              ▼
┌─ bkend.ai ──┐    │    ┌─ Scheduler (Cron) ──────────┐
│ Auth (JWT)  │    │    │ 주기적 수집 트리거            │
│ DB (tables) │    │    │ → CLI subprocess 호출         │
│ RLS (권한)  │    │    │ → Delta 감지 → DB 저장        │
└─────────────┘    │    └──────────────┬───────────────┘
                   │                   │
                   ▼                   ▼
          ┌─ CLI Engine (Python) ──────────────┐
          │ cli-anything-naver-land             │
          │ ┌──────────┐ ┌────────────────┐    │
          │ │ naver_api │ │ Anti-blocking  │    │
          │ │ search    │ │ Session rotate │    │
          │ │ filter    │ │ Delay control  │    │
          │ └─────┬────┘ └────────────────┘    │
          └───────┼────────────────────────────┘
                  │
                  ▼
          ┌─ Naver Land API ──┐
          │ m.land.naver.com  │
          └───────────────────┘
```

---

## 6. 주요 화면 구성

### 6.1 페이지 목록

| 경로 | 페이지 | 권한 | 설명 |
|------|--------|------|------|
| `/` | 랜딩 | 공개 | 서비스 소개, 로그인/가입 버튼 |
| `/login` | 로그인 | 공개 | 이메일/비밀번호 입력 |
| `/signup` | 회원가입 | 공개 | 이메일/비밀번호/이름 입력 |
| `/pending` | 승인 대기 | pending | "관리자 승인 대기 중" 안내 |
| `/search` | 매물 검색 | approved | 검색, 필터, 결과 테이블 |
| `/dashboard` | 대시보드 | approved | 시장 개요, 차트, 동향 |
| `/admin` | 관리자 패널 | admin | 사용자 관리, 수집 설정 |
| `/admin/users` | 사용자 관리 | admin | 승인/거부/정지 목록 |
| `/admin/collector` | 수집 관리 | admin | 수집 대상/주기/이력 |

### 6.2 검색 페이지 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ NavBar [로고] [검색] [대시보드] [프로필▼]           │
├─────────────────────────────────────────────────────┤
│ ┌─ 자연어 검색바 ─────────────────────────────────┐ │
│ │ 🔍 강남 30평대 매매 10억 이하                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ 필터 패널 ──────────────────────────────────── ┐ │
│ │ 지역: [서울 ▼] [강남구 ▼]                       │ │
│ │ 거래: [매매☑] [전세☑] [월세☐]                    │ │
│ │ 평형: [전체▼]  가격: [__억] ~ [__억]            │ │
│ │ 정렬: [추천순▼]  [검색] [초기화] [💾저장]       │ │
│ └─────────────────────────────────────────────── ─┘ │
│                                                     │
│ 📊 총 247건 | 평균 8.2억 | 강남구 매매 기준       │
│                                                     │
│ ┌─ 결과 테이블 ───────────────────────────────── ┐ │
│ │ 단지명▲    | 거래 | 면적    | 가격▼  | 층  |🔗│ │
│ │ ─────────────────────────────────────────────── │ │
│ │ 래미안강남  | 매매 | 34평    | 25억   | 8/20|🔗│ │
│ │ 개포자이   | 매매 | 30평    | 22.5억 | 3/15|🔗│ │
│ │ ...                                             │ │
│ │ ◀ 1 2 3 4 5 ▶                                  │ │
│ └─────────────────────────────────────────────── ┘ │
│                                                     │
│ [📥 CSV] [📥 JSON] [📥 Excel]                      │
└─────────────────────────────────────────────────────┘
```

### 6.3 대시보드 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ NavBar [로고] [검색] [대시보드] [프로필▼]           │
├─────────────────────────────────────────────────────┤
│ 지역 선택: [서울 ▼] [강남구 ▼]  기간: [1주▼]      │
│                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│ │ 총 매물  │ │ 평균가격 │ │ 신규매물 │ │ 삭제매물│ │
│ │  1,247   │ │  8.2억   │ │  +34     │ │  -12    │ │
│ │ ▲2.3%   │ │ ▼0.5%   │ │ (오늘)   │ │ (오늘)  │ │
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│                                                     │
│ ┌─ 가격 추이 (Line Chart) ──────────────────────┐  │
│ │  10억 ┤          ╭──╮                          │  │
│ │   9억 ┤     ╭───╯  ╰──╮                       │  │
│ │   8억 ┤ ───╯           ╰───                    │  │
│ │   7억 ┤                                        │  │
│ │       └──3/1──3/5──3/9──3/13──3/16            │  │
│ │  ── 매매 ── 전세                               │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌─ 매물 증감 (Bar) ─────┐ ┌─ 평형 분포 (Donut)─┐  │
│ │  ▓▓▓▓  ░░             │ │     ╭───╮           │  │
│ │  ▓▓▓▓▓ ░░░            │ │   ╭╯30평╰╮         │  │
│ │  ▓▓▓   ░              │ │   │ 42%  │         │  │
│ │  ▓▓▓▓▓▓░░             │ │   ╰╮20평╭╯         │  │
│ │  ■ 신규  □ 삭제       │ │     ╰───╯           │  │
│ └────────────────────────┘ └────────────────────┘  │
│                                                     │
│ ┌─ 거래유형별 가격 비교 (Grouped Bar) ──────────┐  │
│ │  매매  ▓▓▓▓▓▓▓▓▓▓ 8.2억                       │  │
│ │  전세  ▓▓▓▓▓▓     4.8억                        │  │
│ │  월세  ▓▓          120/80                       │  │
│ └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 7. 변경분 수집 (Delta Collection) 상세 설계

### 7.1 수집 플로우

```
[Cron Trigger] (매 6시간 or 관리자 설정)
       │
       ▼
[수집 대상 조회] → collection_jobs 테이블에서 is_active=true
       │
       ▼
[CLI 실행] → python3 -m cli_anything.naver_land search region --json
       │
       ▼
[현재 스냅샷] → JSON 파싱 → NaverListing[]
       │
       ▼
[이전 스냅샷 조회] → listings 테이블에서 최신 snapshot_id 조회
       │
       ▼
[Delta 비교]
  ├─ 신규 매물: 현재에만 있는 atcl_no → change_type = "new"
  ├─ 삭제 매물: 이전에만 있는 atcl_no → change_type = "removed"
  ├─ 가격 상승: 같은 atcl_no인데 가격 증가 → change_type = "price_up"
  └─ 가격 하락: 같은 atcl_no인데 가격 감소 → change_type = "price_down"
       │
       ▼
[DB 저장]
  ├─ listings 테이블: 현재 스냅샷 전체 저장 (snapshot_id 포함)
  ├─ listing_changes 테이블: 변경분만 저장
  └─ market_snapshots 테이블: 요약 통계 저장
       │
       ▼
[collection_jobs 업데이트]
  └─ last_run_at, last_status, total_count, change_count
```

### 7.2 Delta 감지 알고리즘

```typescript
function detectChanges(current: Listing[], previous: Listing[]): Change[] {
  const prevMap = new Map(previous.map(l => [l.atcl_no, l]))
  const currMap = new Map(current.map(l => [l.atcl_no, l]))
  const changes: Change[] = []

  // 신규 매물
  for (const [no, listing] of currMap) {
    if (!prevMap.has(no)) {
      changes.push({ atcl_no: no, change_type: 'new', new_price: listing.price })
    }
  }

  // 삭제 매물
  for (const [no, listing] of prevMap) {
    if (!currMap.has(no)) {
      changes.push({ atcl_no: no, change_type: 'removed', old_price: listing.price })
    }
  }

  // 가격 변동
  for (const [no, curr] of currMap) {
    const prev = prevMap.get(no)
    if (prev && prev.price !== curr.price) {
      changes.push({
        atcl_no: no,
        change_type: curr.price > prev.price ? 'price_up' : 'price_down',
        old_price: prev.price,
        new_price: curr.price,
      })
    }
  }

  return changes
}
```

---

## 8. 구현 단계 (Phase)

### Phase 1: 프로젝트 초기화 & 인증 (Day 1-2)
- [ ] Next.js 15 프로젝트 생성 (App Router)
- [ ] bkend.ai 프로젝트 설정 (MCP 연결)
- [ ] 사용자 테이블 (status, role 필드)
- [ ] 회원가입/로그인 UI + API
- [ ] 관리자 승인 플로우 + 미들웨어
- [ ] 승인 대기 페이지

### Phase 2: CLI 연동 & 검색 (Day 3-4)
- [ ] CLI Python 설치 + JSON 출력 검증
- [ ] Next.js API Route에서 CLI subprocess 호출
- [ ] NLQ 파서 연동 (자연어 → 검색 파라미터)
- [ ] 검색 UI (지역 선택, 필터 패널, 결과 테이블)
- [ ] 내보내기 (CSV/JSON/Excel)

### Phase 3: 데이터 수집 & DB 구축 (Day 5-6)
- [ ] listings, listing_changes, collection_jobs 테이블 생성
- [ ] CLI 개선: 다중 지역 배치 검색, 가격 정규화
- [ ] Delta Detection 모듈 구현
- [ ] 수집 스케줄러 (Cron) 구현
- [ ] 관리자 수집 관리 UI

### Phase 4: 대시보드 & 시각화 (Day 7-8)
- [ ] market_snapshots 테이블 + 요약 통계 집계
- [ ] 대시보드 UI (카드, 차트)
- [ ] 가격 추이 Line Chart (Recharts)
- [ ] 매물 증감 Bar Chart
- [ ] 평형 분포 Donut Chart
- [ ] 거래유형 비교 Grouped Bar

### Phase 5: 품질 & 배포 (Day 9-10)
- [ ] 코드 리뷰 + Gap 분석
- [ ] 보안 점검 (인증, 인가, 입력 검증)
- [ ] 반응형 UI 최적화
- [ ] Vercel 배포 + 환경변수 설정
- [ ] 운영 모니터링 설정

---

## 9. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 네이버 API 차단 | 수집 중단 | Anti-blocking 강화, Proxy 풀, 수집 간격 조절 |
| 네이버 API 구조 변경 | 파싱 실패 | Raw 응답 아카이브 + 파서 버전 관리 |
| 대량 수집 시 성능 | 수집 지연 | 비동기 처리, 우선순위 기반 수집 |
| bkend.ai 서비스 장애 | 인증/DB 불가 | 로컬 캐시 폴백, 서비스 상태 모니터링 |
| 사용자 급증 | API Rate Limit | 결과 캐싱, CDN, 요청 제한 |

---

## 10. 성공 기준

| 지표 | 목표 |
|------|------|
| 검색 응답 시간 | < 5초 (캐시 미적중 시) |
| 대시보드 로딩 | < 2초 |
| 수집 성공률 | > 95% |
| 변경분 감지 정확도 | > 99% |
| 테스트 커버리지 | > 80% |
| Lighthouse 성능 | > 90 |
