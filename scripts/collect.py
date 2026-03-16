#!/usr/bin/env python3
"""
네이버 부동산 매물 수집 스크립트 (GitHub Actions에서 실행)
- 활성화된 수집 작업(collection_jobs)을 조회
- CLI로 매물 수집
- Delta 감지 (신규/삭제/가격변동)
- Supabase DB에 저장
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any

try:
    from supabase import create_client, Client
except ImportError:
    print("supabase 패키지가 필요합니다: pip install supabase")
    sys.exit(1)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("SUPABASE_URL과 SUPABASE_SERVICE_KEY 환경변수가 필요합니다.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_active_jobs() -> list[dict]:
    """활성화된 수집 작업 목록 조회"""
    result = supabase.table("collection_jobs").select("*").eq("is_active", True).execute()
    return result.data or []


def run_cli_search(district: str, city: str, trade_types: list[str]) -> list[dict]:
    """CLI로 매물 검색 실행"""
    cmd = [
        sys.executable, "-m", "cli_anything.naver_land",
        "--json",
        "search", "region",
        "-d", district,
    ]
    if city:
        cmd.extend(["-c", city])
    for tt in trade_types:
        cmd.extend(["-t", tt])

    cli_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cli-naver-land")

    try:
        result = subprocess.run(
            cmd,
            cwd=cli_dir,
            capture_output=True,
            text=True,
            timeout=60,
            env={**os.environ, "PYTHONPATH": cli_dir},
        )
        if result.returncode != 0:
            print(f"  CLI 오류: {result.stderr[:200]}")
            return []
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        print(f"  CLI 타임아웃: {district}")
        return []
    except json.JSONDecodeError:
        print(f"  JSON 파싱 실패: {district}")
        return []
    except Exception as e:
        print(f"  CLI 실행 실패: {e}")
        return []


def parse_korean_price(price_str: str) -> int:
    """한글 가격을 만원 단위로 변환"""
    if not price_str:
        return 0
    import re
    cleaned = price_str.replace(",", "").strip()
    m = re.match(r"(\d+)\s*억\s*(\d*)", cleaned)
    if m:
        eok = int(m.group(1)) * 10000
        remainder = int(m.group(2)) if m.group(2) else 0
        return eok + remainder
    try:
        return int(cleaned)
    except ValueError:
        return 0


def get_previous_listings(district_code: str) -> dict[str, dict]:
    """이전 수집의 최신 매물 조회"""
    result = (
        supabase.table("listings")
        .select("atcl_no, price, rent_price, snapshot_id")
        .eq("district_code", district_code)
        .order("collected_at", desc=True)
        .limit(2000)
        .execute()
    )

    prev: dict[str, dict] = {}
    seen_snapshot: str | None = None
    for row in result.data or []:
        if seen_snapshot is None:
            seen_snapshot = row["snapshot_id"]
        if row["snapshot_id"] != seen_snapshot:
            break
        prev[row["atcl_no"]] = row

    return prev


def detect_changes(
    current: list[dict], previous: dict[str, dict], district_name: str, snapshot_id: str
) -> list[dict]:
    """Delta 감지: 신규/삭제/가격변동"""
    changes: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()

    curr_map = {}
    for item in current:
        atcl_no = item.get("atcl_no", "")
        price = parse_korean_price(item.get("prc", ""))
        curr_map[atcl_no] = {**item, "_price": price}

    # 신규 매물
    for no, item in curr_map.items():
        if no not in previous:
            changes.append({
                "atcl_no": no,
                "atcl_nm": item.get("atcl_nm", ""),
                "change_type": "new",
                "new_price": item["_price"],
                "district_code": item.get("cortarNo", ""),
                "district_name": district_name,
                "trade_type": item.get("trad_tp_nm", ""),
                "detected_at": now,
                "snapshot_id": snapshot_id,
            })

    # 삭제 매물
    for no, prev_item in previous.items():
        if no not in curr_map:
            changes.append({
                "atcl_no": no,
                "atcl_nm": "",
                "change_type": "removed",
                "old_price": prev_item.get("price"),
                "district_code": "",
                "district_name": district_name,
                "trade_type": "",
                "detected_at": now,
                "snapshot_id": snapshot_id,
            })

    # 가격 변동
    for no, item in curr_map.items():
        if no in previous:
            old_price = previous[no].get("price", 0)
            new_price = item["_price"]
            if old_price and new_price and old_price != new_price:
                diff = new_price - old_price
                pct = round(diff / old_price * 100, 2) if old_price else 0
                changes.append({
                    "atcl_no": no,
                    "atcl_nm": item.get("atcl_nm", ""),
                    "change_type": "price_up" if diff > 0 else "price_down",
                    "old_price": old_price,
                    "new_price": new_price,
                    "price_diff": diff,
                    "price_diff_percent": pct,
                    "district_code": item.get("cortarNo", ""),
                    "district_name": district_name,
                    "trade_type": item.get("trad_tp_nm", ""),
                    "detected_at": now,
                    "snapshot_id": snapshot_id,
                })

    return changes


def save_listings(raw_listings: list[dict], district_name: str, city_name: str, snapshot_id: str):
    """매물 데이터를 listings 테이블에 저장"""
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for item in raw_listings:
        price = parse_korean_price(item.get("prc", ""))
        rent = parse_korean_price(item.get("rent_prc", "")) if item.get("rent_prc") else None
        spc1 = float(item.get("spc1", 0))

        if spc1 < 66:
            size_type = "소형"
        elif spc1 < 99:
            size_type = "20평대"
        elif spc1 < 132:
            size_type = "30평대"
        else:
            size_type = "중대형"

        rows.append({
            "atcl_no": item.get("atcl_no", ""),
            "atcl_nm": item.get("atcl_nm", ""),
            "district_code": item.get("cortarNo", ""),
            "district_name": district_name,
            "city_name": city_name,
            "trade_type": item.get("trad_tp_nm", ""),
            "property_type": item.get("rlet_tp_nm", ""),
            "exclusive_area": spc1,
            "supply_area": float(item.get("spc2", 0)),
            "pyeong": round(spc1 / 3.3058, 1),
            "size_type": size_type,
            "price": price,
            "price_display": item.get("prc", ""),
            "rent_price": rent,
            "floor_info": item.get("flr_info"),
            "confirm_date": item.get("cfm_ymd"),
            "tags": item.get("tag_list", []),
            "lat": float(item.get("lat", 0)),
            "lng": float(item.get("lng", 0)),
            "naver_url": f"https://m.land.naver.com/article/info/{item.get('atcl_no', '')}",
            "collected_at": now,
            "snapshot_id": snapshot_id,
        })

    if rows:
        # 배치 insert (100건씩)
        for i in range(0, len(rows), 100):
            batch = rows[i:i + 100]
            supabase.table("listings").insert(batch).execute()

    return len(rows)


def save_market_snapshot(
    raw_listings: list[dict],
    changes: list[dict],
    district_code: str,
    district_name: str,
    trade_type: str,
    snapshot_id: str,
):
    """시장 스냅샷 집계 저장"""
    if not raw_listings:
        return

    prices = [parse_korean_price(item.get("prc", "")) for item in raw_listings]
    prices = [p for p in prices if p > 0]

    if not prices:
        return

    prices_sorted = sorted(prices)
    median = prices_sorted[len(prices_sorted) // 2]

    size_dist = {"small": 0, "twenty": 0, "thirty": 0, "large": 0}
    for item in raw_listings:
        spc1 = float(item.get("spc1", 0))
        if spc1 < 66:
            size_dist["small"] += 1
        elif spc1 < 99:
            size_dist["twenty"] += 1
        elif spc1 < 132:
            size_dist["thirty"] += 1
        else:
            size_dist["large"] += 1

    new_count = sum(1 for c in changes if c["change_type"] == "new")
    removed_count = sum(1 for c in changes if c["change_type"] == "removed")
    price_up = sum(1 for c in changes if c["change_type"] == "price_up")
    price_down = sum(1 for c in changes if c["change_type"] == "price_down")

    snapshot = {
        "district_code": district_code,
        "district_name": district_name,
        "snapshot_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "trade_type": trade_type,
        "total_count": len(raw_listings),
        "avg_price": round(sum(prices) / len(prices)),
        "median_price": median,
        "min_price": min(prices),
        "max_price": max(prices),
        "size_distribution": size_dist,
        "new_count": new_count,
        "removed_count": removed_count,
        "price_up_count": price_up,
        "price_down_count": price_down,
        "snapshot_id": snapshot_id,
    }

    supabase.table("market_snapshots").insert(snapshot).execute()


def update_job_status(job_id: str, status: str, total: int, changes: int, error: str | None = None):
    """수집 작업 상태 업데이트"""
    update_data: dict[str, Any] = {
        "last_run_at": datetime.now(timezone.utc).isoformat(),
        "last_status": status,
        "total_count": total,
        "change_count": changes,
        "last_error": error,
    }
    supabase.table("collection_jobs").update(update_data).eq("id", job_id).execute()


def main():
    print(f"=== 수집 시작: {datetime.now(timezone.utc).isoformat()} ===")

    jobs = get_active_jobs()
    if not jobs:
        print("활성화된 수집 작업이 없습니다.")
        return

    print(f"활성 작업: {len(jobs)}건")

    for job in jobs:
        district = job["district_name"]
        city = job["city_name"]
        trade_types = job.get("trade_types", ["매매"])
        snapshot_id = f"snap-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{job['id'][:8]}"

        print(f"\n--- {city} {district} ({', '.join(trade_types)}) ---")

        try:
            # 1. CLI로 현재 매물 수집
            raw_listings = run_cli_search(district, city, trade_types)
            print(f"  수집: {len(raw_listings)}건")

            if not raw_listings:
                update_job_status(job["id"], "failed", 0, 0, "수집 결과 없음")
                continue

            # 2. 이전 매물 조회
            district_code = raw_listings[0].get("cortarNo", "") if raw_listings else ""
            previous = get_previous_listings(district_code)
            print(f"  이전: {len(previous)}건")

            # 3. Delta 감지
            changes = detect_changes(raw_listings, previous, district, snapshot_id)
            new_count = sum(1 for c in changes if c["change_type"] == "new")
            removed_count = sum(1 for c in changes if c["change_type"] == "removed")
            price_changed = sum(1 for c in changes if c["change_type"] in ("price_up", "price_down"))
            print(f"  변경: 신규 {new_count}, 삭제 {removed_count}, 가격변동 {price_changed}")

            # 4. DB 저장
            saved = save_listings(raw_listings, district, city, snapshot_id)
            print(f"  저장: {saved}건")

            # 5. 변경 이력 저장
            if changes:
                for i in range(0, len(changes), 100):
                    batch = changes[i:i + 100]
                    supabase.table("listing_changes").insert(batch).execute()

            # 6. 시장 스냅샷 저장
            for tt in trade_types:
                tt_listings = [l for l in raw_listings if l.get("trad_tp_nm") == tt]
                tt_changes = [c for c in changes if c.get("trade_type") == tt]
                if tt_listings:
                    save_market_snapshot(tt_listings, tt_changes, district_code, district, tt, snapshot_id)

            # 7. 작업 상태 업데이트
            update_job_status(job["id"], "success", len(raw_listings), len(changes))
            print(f"  완료!")

        except Exception as e:
            print(f"  실패: {e}")
            update_job_status(job["id"], "failed", 0, 0, str(e)[:500])

    print(f"\n=== 수집 완료: {datetime.now(timezone.utc).isoformat()} ===")


if __name__ == "__main__":
    main()
