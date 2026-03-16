# 인프라 수정: 무료 실시간 인프라 전환

**변경일:** 2026-03-16
**사유:** 모든 인프라를 무료 티어로 운영 가능해야 함

---

## 기존 → 변경 비교

| 항목 | 기존 (유료 가능) | 변경 (무료) | 이유 |
|------|---------------|------------|------|
| **DB** | bkend.ai (BaaS) | **Supabase Free Tier** | PostgreSQL, 500MB, 무제한 API, 무료 Auth |
| **인증** | bkend.ai Auth | **Supabase Auth** | 무료 JWT + RLS, 소셜 로그인 지원 |
| **배포** | Vercel (Pro) | **Vercel Hobby** | Next.js 무료, 100GB bandwidth |
| **스케줄러** | Vercel Cron (Pro) | **GitHub Actions Cron** | 무료 2000분/월, cron schedule 지원 |
| **수집 서버** | Vercel Serverless | **GitHub Actions + Supabase** | Actions에서 CLI 실행 → Supabase에 저장 |

---

## 무료 인프라 스택 상세

### 1. Supabase (Free Tier)

| 리소스 | 무료 제한 | 우리 예상 사용량 |
|--------|----------|----------------|
| DB 용량 | 500MB | ~50MB (초기 6개월) |
| Auth 사용자 | 50,000 MAU | < 100 |
| API 요청 | 무제한 | ~10,000/일 |
| Realtime | 200 동시 연결 | < 50 |
| Edge Functions | 500K/월 | < 10K |
| Storage | 1GB | 사용 안 함 |

**활용:**
- PostgreSQL DB → listings, listing_changes, market_snapshots 테이블
- Supabase Auth → 이메일 가입/로그인 + JWT + RLS
- Realtime → 대시보드 실시간 업데이트 (수집 완료 시 push)

### 2. Vercel (Hobby Plan)

| 리소스 | 무료 제한 |
|--------|----------|
| Bandwidth | 100GB/월 |
| Serverless | 100GB-hours |
| Build | 6000분/월 |
| Edge | 무제한 |

**제한사항:**
- Serverless 함수 실행 최대 **10초** (Hobby)
- → CLI subprocess 호출(15~30초)은 Vercel에서 불가
- → **해결: 검색은 클라이언트 → Supabase Edge Function (최대 150초) 또는 수집 데이터 조회**

### 3. GitHub Actions (Free)

| 리소스 | 무료 제한 |
|--------|----------|
| 실행 시간 | 2,000분/월 |
| 동시 작업 | 20 |
| cron 스케줄 | 지원 (최소 5분 간격) |

**활용:**
- 주기적 수집 (cron: `0 */6 * * *` = 6시간마다)
- Python CLI 실행 → JSON 결과 → Supabase DB insert
- Delta 감지 → listing_changes 저장
- 월 예상: 4회/일 × 5분/회 × 30일 = 600분 (여유 충분)

---

## 변경된 아키텍처

```
┌─ Browser ──────────────────────────────────────────┐
│  Next.js App (Vercel Hobby)                         │
│  ┌──────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │ Auth     │ │ 검색       │ │ 대시보드         │  │
│  │(Supabase)│ │(DB 조회)   │ │ (차트/통계)      │  │
│  └────┬─────┘ └─────┬──────┘ └────────┬─────────┘  │
└───────┼─────────────┼─────────────────┼─────────────┘
        │             │                 │
        ▼             ▼                 ▼
┌─ Supabase (Free) ────────────────────────────────── ┐
│  Auth (JWT + RLS)                                    │
│  PostgreSQL (listings, changes, snapshots)            │
│  Realtime (수집 완료 push)                            │
└──────────────────────────┬───────────────────────────┘
                           │
                    (수집 데이터 insert)
                           │
┌─ GitHub Actions (Free) ──┴──────────────────────────┐
│  Cron Schedule (매 6시간)                            │
│  ├── Python CLI 실행 (네이버 API 호출)              │
│  ├── Delta Detection (이전 vs 현재)                 │
│  ├── Supabase DB Insert (신규/변경분)               │
│  └── Market Snapshot 집계                           │
└──────────────────────────────────────────────────────┘
```

---

## 검색 방식 변경

### 기존: 실시간 CLI 호출
```
User → API Route → CLI subprocess → Naver API → Response
```
**문제:** Vercel Hobby는 10초 타임아웃으로 CLI 호출 불가

### 변경: 수집 데이터 DB 조회 + 실시간 옵션

**방식 A (기본): DB 조회 - 수집된 데이터에서 검색**
```
User → Next.js API → Supabase PostgreSQL Query → Response
```
- 장점: < 1초 응답, 안정적, 무료
- 단점: 데이터가 수집 주기만큼 지연 (최대 6시간)

**방식 B (옵션): Supabase Edge Function으로 실시간 검색**
```
User → Supabase Edge Function (150초 제한) → Python subprocess or fetch → Naver API
```
- 장점: 실시간 최신 데이터
- 단점: Deno 환경에서 Python CLI 호출 불가 → HTTP 직접 호출 필요

**최종 결정: 방식 A 기본 + 수집 주기를 짧게 (6시간 → 1시간)**
- GitHub Actions cron: `0 * * * *` (매 시간)
- 월 사용량: 24회/일 × 5분 × 30일 = 3,600분 → 2,000분 초과!
- **조정:** 주요 시간대만 수집 (오전 6시~밤 12시, 2시간 간격)
  - `0 6,8,10,12,14,16,18,20,22 * * *` = 9회/일
  - 월: 9 × 5분 × 30일 = 1,350분 (여유 있음)

---

## 코드 변경 영향

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/user-store.ts` | → Supabase Auth + profiles 테이블로 교체 |
| `src/lib/cli-bridge.ts` | → 검색 시 Supabase DB 조회로 교체 (실시간 CLI 호출 제거) |
| `src/app/api/search/*` | → Supabase 쿼리로 변경 |
| `src/app/api/auth/*` | → Supabase Auth SDK 사용 |
| 신규: `.github/workflows/collect.yml` | 수집 GitHub Actions 워크플로우 |
| 신규: `scripts/collect.py` | 수집 + Delta 감지 + Supabase insert 스크립트 |

---

## 비용 요약: 완전 무료

| 서비스 | 요금 | 비고 |
|--------|------|------|
| Vercel Hobby | $0 | Next.js 배포 |
| Supabase Free | $0 | DB + Auth |
| GitHub Actions | $0 | 수집 스케줄러 |
| Naver API | $0 | 비공식 API (무료) |
| **합계** | **$0/월** | |
