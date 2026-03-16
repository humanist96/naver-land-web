/**
 * 자연어 검색 파서 (TypeScript 구현)
 * CLI의 nlq.py 로직을 포팅
 */

interface ParsedQuery {
  districtName?: string
  cityName?: string
  complexName?: string
  tradeTypes: string[]
  sizeType?: string
  minPrice?: number
  maxPrice?: number
  sort: string
}

const TRADE_KEYWORDS: Record<string, string> = {
  '매매': '매매', '사다': '매매', '살': '매매', '구매': '매매', '분양': '매매',
  '전세': '전세', '임대': '전세',
  '월세': '월세', '단기': '월세', '단기임대': '월세',
}

const SIZE_KEYWORDS: Record<string, string> = {
  '소형': '소형',
  '20평': '20평대', '20평대': '20평대',
  '30평': '30평대', '30평대': '30평대',
  '40평': '중대형', '50평': '중대형', '대형': '중대형', '중대형': '중대형',
}

const SORT_KEYWORDS: Record<string, string> = {
  '싼': 'prc', '저렴': 'prc', '가격순': 'prc',
  '최신': 'date', '새로운': 'date', '최근': 'date',
  '넓은': 'spc', '큰': 'spc', '면적순': 'spc',
  '추천순': 'rank',
}

const DISTRICT_SUFFIXES = ['구', '시', '군']

const KNOWN_DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
  '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
  '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
]

const KNOWN_CITIES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

function parsePrice(text: string): number | null {
  const match = text.match(/(\d+)\s*억\s*(\d*)/)
  if (match) {
    const eok = parseInt(match[1], 10) * 10000
    const remainder = match[2] ? parseInt(match[2], 10) : 0
    return eok + remainder
  }
  const numMatch = text.match(/(\d+)\s*만/)
  if (numMatch) {
    return parseInt(numMatch[1], 10)
  }
  return null
}

export function parseNlq(query: string): ParsedQuery {
  const result: ParsedQuery = {
    tradeTypes: [],
    sort: 'rank',
  }

  const tokens = query.trim().split(/\s+/)
  const remaining: string[] = []

  for (const token of tokens) {
    // 거래유형
    if (TRADE_KEYWORDS[token]) {
      result.tradeTypes.push(TRADE_KEYWORDS[token])
      continue
    }

    // 평형
    if (SIZE_KEYWORDS[token]) {
      result.sizeType = SIZE_KEYWORDS[token]
      continue
    }

    // 정렬
    if (SORT_KEYWORDS[token]) {
      result.sort = SORT_KEYWORDS[token]
      continue
    }

    remaining.push(token)
  }

  // 가격 파싱 (이하/이상 포함)
  const priceBelow = query.match(/(\d+\s*억\s*\d*)\s*이하/)
  if (priceBelow) {
    result.maxPrice = parsePrice(priceBelow[1]) ?? undefined
  }

  const priceAbove = query.match(/(\d+\s*억\s*\d*)\s*이상/)
  if (priceAbove) {
    result.minPrice = parsePrice(priceAbove[1]) ?? undefined
  }

  // 가격 범위 (~)
  const priceRange = query.match(/(\d+\s*억\s*\d*)\s*[~\-]\s*(\d+\s*억\s*\d*)/)
  if (priceRange) {
    result.minPrice = parsePrice(priceRange[1]) ?? undefined
    result.maxPrice = parsePrice(priceRange[2]) ?? undefined
  }

  // 지역 파싱
  for (const token of remaining) {
    // 도시명
    const cityMatch = KNOWN_CITIES.find(c => token.includes(c))
    if (cityMatch) {
      result.cityName = cityMatch.endsWith('시') || cityMatch.endsWith('도')
        ? cityMatch
        : cityMatch + (
          ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'].includes(cityMatch)
            ? '시' : '도'
        )
      continue
    }

    // 구 이름 (정확 매칭)
    const districtExact = KNOWN_DISTRICTS.find(d => token === d || token + '구' === d)
    if (districtExact) {
      result.districtName = districtExact
      continue
    }

    // 구 이름 (부분 매칭)
    const districtPartial = KNOWN_DISTRICTS.find(d => d.startsWith(token))
    if (districtPartial && token.length >= 2) {
      result.districtName = districtPartial
      continue
    }

    // 단지명으로 간주 (2자 이상, 숫자 포함 등)
    if (token.length >= 2 && !['이하', '이상', '억', '만', '제일'].includes(token)) {
      result.complexName = result.complexName ? result.complexName + ' ' + token : token
    }
  }

  // 기본 거래유형
  if (result.tradeTypes.length === 0) {
    result.tradeTypes = ['매매']
  }

  // 중복 제거
  result.tradeTypes = [...new Set(result.tradeTypes)]

  return result
}
