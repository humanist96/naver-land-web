# Naver Land CLI — Test Plan

## Unit Tests (test_core.py)

### Districts (~15 tests)
- Seoul 25 districts count
- District data structure fields
- cortarNo format
- coord_params format
- find_district exact match
- find_district without 구 suffix
- find_district partial match
- find_district not found
- list_districts count
- Trade type mappings
- Property type mappings
- Sort options
- All districts have valid coordinates
- District immutability (frozen dataclass)

### NaverListing (~10 tests)
- from_api_response basic
- Size classification
- Pyeong conversion
- to_dict
- to_table_row
- rent_prc None when empty
- rent_prc with value
- Missing fields default
- classify_size boundaries
- sqm_to_pyeong accuracy

### Filter (~15 tests)
- parse_price: 억+remainder, 억 only, plain number, comma, edge cases
- parse_floor_filter: plus, range, single
- extract_floor: with total, single, None, empty
- FilterCriteria: is_empty, not_empty, to_dict
- apply_filters: by size, area, price, floor, combined, empty

### Session (~8 tests)
- record and history
- undo
- redo
- undo empty
- redo empty
- status
- save and load
- HistoryEntry serialization

### Export (~2 tests)
- export_csv
- export_json

### Search with mocked API (~5 tests)
- search_region basic
- search_region with trade type
- search_region invalid district
- search_complex basic
- search_complex no match

## E2E Tests (test_full_e2e.py)

### Search (~8 tests)
- search_jongno basic (connectivity)
- search_jongno trade_type (매매)
- search_jongno jeonse (전세)
- search_jongno villa (VL)
- search_jongno officetel (OPST)
- listing fields verification
- filter after search
- filter by price

### Export (~2 tests)
- export CSV e2e
- export JSON e2e

### Districts (~1 test)
- All districts searchable by name

### API Client (~2 tests)
- fetch single page
- fetch with sort

## Running Tests

```bash
# Unit tests only (no network)
pytest cli_anything/naver_land/tests/test_core.py -v

# E2E tests (requires network)
pytest cli_anything/naver_land/tests/test_full_e2e.py -v -s

# All tests
pytest cli_anything/naver_land/tests/ -v

# With coverage
pytest cli_anything/naver_land/tests/test_core.py -v --cov=cli_anything.naver_land --cov-report=term-missing
```
