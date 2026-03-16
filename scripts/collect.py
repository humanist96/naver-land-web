#!/usr/bin/env python3
"""
네이버 부동산 매물 수집 스크립트 (GitHub Actions)
네이버 API를 직접 호출 (CLI 의존성 제거)
"""

import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

try:
    from supabase import create_client, Client
except ImportError:
    print("pip install supabase")
    sys.exit(1)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("SUPABASE_URL, SUPABASE_SERVICE_KEY 환경변수 필요")
    sys.exit(1)

db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── 네이버 API 설정 ──
BASE_URL = "https://m.land.naver.com"
ARTICLE_URL = f"{BASE_URL}/cluster/ajax/articleList"

SEOUL_COORDS: dict[str, tuple[str, str]] = {
    "강남구":  ("1168000000", "&z=13&btm=37.4581565&lft=126.9577058&top=37.5766125&rgt=127.1369202"),
    "강동구":  ("1174000000", "&z=13&btm=37.4708846&lft=127.0341638&top=37.5893204&rgt=127.2133782"),
    "강북구":  ("1130500000", "&z=13&btm=37.5805857&lft=126.9358808&top=37.6988473&rgt=127.1150952"),
    "강서구":  ("1150000000", "&z=13&btm=37.4917601&lft=126.7599268&top=37.6101628&rgt=126.9391412"),
    "관악구":  ("1162000000", "&z=13&btm=37.4217406&lft=126.8619938&top=37.5402544&rgt=127.0412082"),
    "광진구":  ("1121500000", "&z=13&btm=37.5004921&lft=126.9763088&top=37.6189023&rgt=127.1555232"),
    "구로구":  ("1153000000", "&z=13&btm=37.4362411&lft=126.7979248&top=37.5547319&rgt=126.9771392"),
    "금천구":  ("1154500000", "&z=13&btm=37.3926566&lft=126.8124678&top=37.5112164&rgt=126.9916822"),
    "노원구":  ("1135000000", "&z=13&btm=37.5951433&lft=126.9668038&top=37.7133817&rgt=127.1460182"),
    "도봉구":  ("1132000000", "&z=13&btm=37.6096368&lft=126.9575558&top=37.7278521&rgt=127.1367702"),
    "동대문구": ("1123000000", "&z=13&btm=37.5226426&lft=126.9542218&top=37.6410614&rgt=127.1334362"),
    "동작구":  ("1159000000", "&z=13&btm=37.4531945&lft=126.8498928&top=37.5716584&rgt=127.0291072"),
    "마포구":  ("1144000000", "&z=13&btm=37.5043021&lft=126.8187928&top=37.6226849&rgt=126.9980072"),
    "서대문구": ("1141000000", "&z=13&btm=37.5200226&lft=126.8471928&top=37.6383804&rgt=127.0264072"),
    "서초구":  ("1165000000", "&z=13&btm=37.4242856&lft=126.9429868&top=37.5427954&rgt=127.1222012"),
    "성동구":  ("1120000000", "&z=13&btm=37.5097131&lft=126.9535248&top=37.6281434&rgt=127.1327392"),
    "성북구":  ("1129000000", "&z=13&btm=37.5461066&lft=126.9388448&top=37.6644713&rgt=127.1180592"),
    "송파구":  ("1171000000", "&z=13&btm=37.4553382&lft=127.0162558&top=37.5737987&rgt=127.1954702"),
    "양천구":  ("1147000000", "&z=13&btm=37.4577552&lft=126.7769388&top=37.5762118&rgt=126.9561532"),
    "영등포구": ("1156000000", "&z=13&btm=37.4671226&lft=126.8066058&top=37.5855644&rgt=126.9858202"),
    "용산구":  ("1117000000", "&z=13&btm=37.4898965&lft=126.9096398&top=37.6083519&rgt=127.0888542"),
    "은평구":  ("1138000000", "&z=13&btm=37.5435963&lft=126.8395558&top=37.6619167&rgt=127.0187702"),
    "종로구":  ("1111000000", "&z=13&btm=37.5401246&lft=126.9123428&top=37.6584939&rgt=127.0915572"),
    "중구":    ("1114000000", "&z=13&btm=37.5086596&lft=126.9122398&top=37.6271234&rgt=127.0914542"),
    "중랑구":  ("1126000000", "&z=13&btm=37.5467206&lft=126.9890098&top=37.6651036&rgt=127.1682242"),
}

TRADE_MAP = {"매매": "A1", "전세": "B1", "월세": "B2"}

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def fetch_naver(district: str, trade_types: list[str], limit: int = 500) -> list[dict]:
    """네이버 API 직접 호출로 매물 조회"""
    if district not in SEOUL_COORDS:
        print(f"  알 수 없는 지역: {district}")
        return []

    cortar_no, coords = SEOUL_COORDS[district]
    trad_tp_cd = ":".join(TRADE_MAP.get(t, "A1") for t in trade_types)
    rlet_tp_cd = "APT:JGC"

    all_articles: list[dict] = []
    page = 1

    while len(all_articles) < limit and page <= 20:
        url = f"{ARTICLE_URL}?rletTpCd={rlet_tp_cd}&tradTpCd={trad_tp_cd}{coords}&cortarNo={cortar_no}&sort=rank&page={page}"

        headers = {
            "User-Agent": UA,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "ko-KR,ko;q=0.9",
            "Referer": f"{BASE_URL}/map/37.5665:126.978:13/APT",
            "X-Requested-With": "XMLHttpRequest",
            "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
        }

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
                body = data.get("body", [])
                if not body:
                    break
                all_articles.extend(body)
                page += 1
                # anti-blocking 딜레이
                delay = random.uniform(3.0, 6.0)
                time.sleep(delay)
        except Exception as e:
            print(f"  API 호출 실패 (page {page}): {e}")
            break

    return all_articles[:limit]


def parse_price(s: str) -> int:
    if not s:
        return 0
    s = s.replace(",", "").strip()
    m = re.match(r"(\d+)\s*억\s*(\d*)", s)
    if m:
        return int(m.group(1)) * 10000 + (int(m.group(2)) if m.group(2) else 0)
    try:
        return int(s)
    except ValueError:
        return 0


def classify_size(spc1: float) -> str:
    if spc1 < 66: return "소형"
    if spc1 < 99: return "20평대"
    if spc1 < 132: return "30평대"
    return "중대형"


def to_listing_row(art: dict, district: str, city: str, snapshot_id: str) -> dict:
    spc1 = float(art.get("spc1", 0))
    prc = art.get("hanPrc") or art.get("prc", "")
    return {
        "atcl_no": art.get("atclNo", ""),
        "atcl_nm": art.get("atclNm", ""),
        "district_code": art.get("cortarNo", ""),
        "district_name": district,
        "city_name": city,
        "trade_type": art.get("tradTpNm", ""),
        "property_type": art.get("rletTpNm", ""),
        "exclusive_area": spc1,
        "supply_area": float(art.get("spc2", 0)),
        "pyeong": round(spc1 / 3.3058, 1),
        "size_type": classify_size(spc1),
        "price": parse_price(prc),
        "price_display": prc,
        "rent_price": parse_price(art.get("rentPrc", "")) or None,
        "floor_info": art.get("flrInfo"),
        "confirm_date": art.get("atclCfmYmd"),
        "tags": art.get("tagList", []),
        "lat": float(art.get("lat", 0)),
        "lng": float(art.get("lng", 0)),
        "naver_url": f"https://m.land.naver.com/article/info/{art.get('atclNo', '')}",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "snapshot_id": snapshot_id,
    }


def save_batch(rows: list[dict]) -> int:
    """DB에 배치 저장 (100건씩)"""
    saved = 0
    for i in range(0, len(rows), 100):
        batch = rows[i:i + 100]
        try:
            db.table("listings").insert(batch).execute()
            saved += len(batch)
        except Exception as e:
            print(f"  DB 저장 실패: {e}")
    return saved


def get_prev_listings(district_code: str) -> dict[str, dict]:
    """이전 수집 매물 조회"""
    try:
        result = db.table("listings") \
            .select("atcl_no, price, rent_price, snapshot_id") \
            .eq("district_code", district_code) \
            .order("collected_at", desc=True) \
            .limit(2000) \
            .execute()
    except Exception:
        return {}

    prev: dict[str, dict] = {}
    snap_id = None
    for row in result.data or []:
        if snap_id is None:
            snap_id = row["snapshot_id"]
        if row["snapshot_id"] != snap_id:
            break
        prev[row["atcl_no"]] = row
    return prev


def detect_and_save_changes(articles: list[dict], prev: dict[str, dict], district: str, snapshot_id: str):
    """변경분 감지 + listing_changes 저장"""
    now = datetime.now(timezone.utc).isoformat()
    changes: list[dict] = []

    curr_map: dict[str, dict] = {}
    for art in articles:
        no = art.get("atclNo", "")
        prc = parse_price(art.get("hanPrc") or art.get("prc", ""))
        curr_map[no] = {**art, "_price": prc}

    for no, item in curr_map.items():
        if no not in prev:
            changes.append({"atcl_no": no, "atcl_nm": item.get("atclNm", ""),
                            "change_type": "new", "new_price": item["_price"],
                            "district_code": item.get("cortarNo", ""), "district_name": district,
                            "trade_type": item.get("tradTpNm", ""), "detected_at": now, "snapshot_id": snapshot_id})

    for no, prev_item in prev.items():
        if no not in curr_map:
            changes.append({"atcl_no": no, "atcl_nm": "",
                            "change_type": "removed", "old_price": prev_item.get("price"),
                            "district_code": "", "district_name": district,
                            "trade_type": "", "detected_at": now, "snapshot_id": snapshot_id})

    for no, item in curr_map.items():
        if no in prev:
            old_p = prev[no].get("price", 0)
            new_p = item["_price"]
            if old_p and new_p and old_p != new_p:
                diff = new_p - old_p
                pct = round(diff / old_p * 100, 2) if old_p else 0
                changes.append({"atcl_no": no, "atcl_nm": item.get("atclNm", ""),
                                "change_type": "price_up" if diff > 0 else "price_down",
                                "old_price": old_p, "new_price": new_p,
                                "price_diff": diff, "price_diff_percent": pct,
                                "district_code": item.get("cortarNo", ""), "district_name": district,
                                "trade_type": item.get("tradTpNm", ""), "detected_at": now, "snapshot_id": snapshot_id})

    if changes:
        for i in range(0, len(changes), 100):
            try:
                db.table("listing_changes").insert(changes[i:i + 100]).execute()
            except Exception as e:
                print(f"  변경 저장 실패: {e}")

    return len(changes)


def save_market_snapshot(articles: list[dict], changes_count: int, district_code: str, district: str, trade_type: str, snapshot_id: str):
    """시장 스냅샷 저장"""
    prices = [parse_price(a.get("hanPrc") or a.get("prc", "")) for a in articles]
    prices = [p for p in prices if p > 0]
    if not prices:
        return

    sorted_p = sorted(prices)
    size_dist = {"small": 0, "twenty": 0, "thirty": 0, "large": 0}
    for a in articles:
        spc1 = float(a.get("spc1", 0))
        if spc1 < 66: size_dist["small"] += 1
        elif spc1 < 99: size_dist["twenty"] += 1
        elif spc1 < 132: size_dist["thirty"] += 1
        else: size_dist["large"] += 1

    try:
        db.table("market_snapshots").insert({
            "district_code": district_code,
            "district_name": district,
            "snapshot_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "trade_type": trade_type,
            "total_count": len(articles),
            "avg_price": round(sum(prices) / len(prices)),
            "median_price": sorted_p[len(sorted_p) // 2],
            "min_price": min(prices),
            "max_price": max(prices),
            "size_distribution": size_dist,
            "new_count": changes_count,
            "removed_count": 0,
            "price_up_count": 0,
            "price_down_count": 0,
            "snapshot_id": snapshot_id,
        }).execute()
    except Exception as e:
        print(f"  스냅샷 저장 실패: {e}")


def update_job(job_id: str, status: str, total: int, changes: int, error: str | None = None):
    try:
        db.table("collection_jobs").update({
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_status": status,
            "total_count": total,
            "change_count": changes,
            "last_error": error,
        }).eq("id", job_id).execute()
    except Exception:
        pass


def main():
    print(f"=== 수집 시작: {datetime.now(timezone.utc).isoformat()} ===")

    jobs = db.table("collection_jobs").select("*").eq("is_active", True).execute().data or []
    if not jobs:
        print("활성 작업 없음")
        return

    print(f"활성 작업: {len(jobs)}건\n")

    for i, job in enumerate(jobs):
        district = job["district_name"]
        city = job["city_name"]
        trade_types = job.get("trade_types", ["매매"])
        snapshot_id = f"snap-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{job['id'][:8]}"

        print(f"[{i+1}/{len(jobs)}] {city} {district} ({', '.join(trade_types)})")

        try:
            # 1. 네이버 API 직접 호출
            articles = fetch_naver(district, trade_types)
            print(f"  수집: {len(articles)}건")

            if not articles:
                update_job(job["id"], "failed", 0, 0, "수집 결과 없음")
                continue

            # 2. DB 저장
            rows = [to_listing_row(a, district, city, snapshot_id) for a in articles]
            saved = save_batch(rows)
            print(f"  저장: {saved}건")

            # 3. 이전 데이터와 비교 (Delta)
            district_code = articles[0].get("cortarNo", "")
            prev = get_prev_listings(district_code)
            change_count = detect_and_save_changes(articles, prev, district, snapshot_id)
            print(f"  변경: {change_count}건")

            # 4. 시장 스냅샷
            for tt in trade_types:
                tt_arts = [a for a in articles if a.get("tradTpNm") == tt]
                if tt_arts:
                    save_market_snapshot(tt_arts, change_count, district_code, district, tt, snapshot_id)

            # 5. 작업 상태 업데이트
            update_job(job["id"], "success", len(articles), change_count)
            print(f"  완료!\n")

        except Exception as e:
            print(f"  실패: {e}\n")
            update_job(job["id"], "failed", 0, 0, str(e)[:500])

        # 구 간 딜레이 (anti-blocking)
        if i < len(jobs) - 1:
            delay = random.uniform(8.0, 15.0)
            print(f"  다음 구까지 {delay:.0f}초 대기...")
            time.sleep(delay)

    print(f"\n=== 수집 완료: {datetime.now(timezone.utc).isoformat()} ===")


if __name__ == "__main__":
    main()
