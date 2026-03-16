# NAVER_LAND.md — SOP for cli-anything-naver-land

## Overview
Interactive CLI tool for searching Naver Land (네이버 부동산) real estate listings.
Supports Seoul 25 districts, multiple property/trade types, filtering, and export.

## Quick Start

```bash
cd naver-land/agent-harness
pip install -e .
cli-anything-naver-land search region -d 강남구 -t 매매 -n 10
```

## Commands

| Command | Description |
|---------|-------------|
| `search region -d <구>` | Search by district |
| `search complex -n <이름> -d <구>` | Search by complex name |
| `search districts` | List supported districts |
| `filter apply` | Apply filters to results |
| `filter clear` | Clear filters |
| `export csv/json/excel -o <파일>` | Export results |
| `config set/get` | Manage settings |
| `session history/undo/redo` | Session management |

## Options (search region)

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| --district | -d | str | (required) | 구 이름 |
| --trade-type | -t | multi | all | 매매/전세/월세/단기임대 |
| --property | -p | choice | APT | APT/VL/OPST/OR/ABYG/JGC/DDDGG |
| --type | | choice | | 소형/20평대/30평대/중대형 |
| --min-area | | float | | Min area (sqm) |
| --max-area | | float | | Max area (sqm) |
| --min-price | | str | | Min price (e.g. 5억) |
| --max-price | | str | | Max price (e.g. 15억) |
| --floor | | str | | Floor filter (e.g. 10+, 3-10) |
| --sort | | choice | rank | rank/prc/spc/date |
| --limit | -n | int | 50 | Max results |

## Architecture

```
cli_anything/naver_land/
├── naver_land_cli.py     # Click CLI entry point + REPL
├── core/
│   ├── districts.py      # Seoul 25 district data
│   ├── search.py         # NaverListing model + orchestration
│   ├── filter.py         # Filter pipeline + price parsing
│   ├── session.py        # Session/history/undo-redo
│   └── export.py         # CSV/JSON/Excel export
└── utils/
    ├── naver_api.py      # HTTP client (UA rotation, backoff)
    ├── formatters.py     # Table/JSON formatters
    └── repl_skin.py      # REPL UI skin
```

## Data Sources
- Naver Land Mobile API: `https://m.land.naver.com/cluster/ajax/articleList`
- No OpenSearch dependency — pure local data retrieval + export
