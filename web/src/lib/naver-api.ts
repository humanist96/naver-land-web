/**
 * 네이버 부동산 API 직접 호출 클라이언트 (TypeScript)
 * CLI의 naver_api.py를 경량 포팅
 * Vercel Edge/Serverless에서 Python 없이 동작
 */

const BASE_URL = 'https://m.land.naver.com'
const ARTICLE_LIST_URL = `${BASE_URL}/cluster/ajax/articleList`
const COMPLEX_ARTICLE_URL = `${BASE_URL}/complex/getComplexArticleList`
const SEARCH_URL = `${BASE_URL}/search/result`

// 서울 구별 좌표 데이터
const SEOUL_COORDS: Record<string, { cortarNo: string; coords: string }> = {
  '강남구':  { cortarNo: '1168000000', coords: '&z=13&btm=37.4581565&lft=126.9577058&top=37.5766125&rgt=127.1369202' },
  '강동구':  { cortarNo: '1174000000', coords: '&z=13&btm=37.4708846&lft=127.0341638&top=37.5893204&rgt=127.2133782' },
  '강북구':  { cortarNo: '1130500000', coords: '&z=13&btm=37.5805857&lft=126.9358808&top=37.6988473&rgt=127.1150952' },
  '강서구':  { cortarNo: '1150000000', coords: '&z=13&btm=37.4917601&lft=126.7599268&top=37.6101628&rgt=126.9391412' },
  '관악구':  { cortarNo: '1162000000', coords: '&z=13&btm=37.4217406&lft=126.8619938&top=37.5402544&rgt=127.0412082' },
  '광진구':  { cortarNo: '1121500000', coords: '&z=13&btm=37.5004921&lft=126.9763088&top=37.6189023&rgt=127.1555232' },
  '구로구':  { cortarNo: '1153000000', coords: '&z=13&btm=37.4362411&lft=126.7979248&top=37.5547319&rgt=126.9771392' },
  '금천구':  { cortarNo: '1154500000', coords: '&z=13&btm=37.3926566&lft=126.8124678&top=37.5112164&rgt=126.9916822' },
  '노원구':  { cortarNo: '1135000000', coords: '&z=13&btm=37.5951433&lft=126.9668038&top=37.7133817&rgt=127.1460182' },
  '도봉구':  { cortarNo: '1132000000', coords: '&z=13&btm=37.6096368&lft=126.9575558&top=37.7278521&rgt=127.1367702' },
  '동대문구': { cortarNo: '1123000000', coords: '&z=13&btm=37.5226426&lft=126.9542218&top=37.6410614&rgt=127.1334362' },
  '동작구':  { cortarNo: '1159000000', coords: '&z=13&btm=37.4531945&lft=126.8498928&top=37.5716584&rgt=127.0291072' },
  '마포구':  { cortarNo: '1144000000', coords: '&z=13&btm=37.5043021&lft=126.8187928&top=37.6226849&rgt=126.9980072' },
  '서대문구': { cortarNo: '1141000000', coords: '&z=13&btm=37.5200226&lft=126.8471928&top=37.6383804&rgt=127.0264072' },
  '서초구':  { cortarNo: '1165000000', coords: '&z=13&btm=37.4242856&lft=126.9429868&top=37.5427954&rgt=127.1222012' },
  '성동구':  { cortarNo: '1120000000', coords: '&z=13&btm=37.5097131&lft=126.9535248&top=37.6281434&rgt=127.1327392' },
  '성북구':  { cortarNo: '1129000000', coords: '&z=13&btm=37.5461066&lft=126.9388448&top=37.6644713&rgt=127.1180592' },
  '송파구':  { cortarNo: '1171000000', coords: '&z=13&btm=37.4553382&lft=127.0162558&top=37.5737987&rgt=127.1954702' },
  '양천구':  { cortarNo: '1147000000', coords: '&z=13&btm=37.4577552&lft=126.7769388&top=37.5762118&rgt=126.9561532' },
  '영등포구': { cortarNo: '1156000000', coords: '&z=13&btm=37.4671226&lft=126.8066058&top=37.5855644&rgt=126.9858202' },
  '용산구':  { cortarNo: '1117000000', coords: '&z=13&btm=37.4898965&lft=126.9096398&top=37.6083519&rgt=127.0888542' },
  '은평구':  { cortarNo: '1138000000', coords: '&z=13&btm=37.5435963&lft=126.8395558&top=37.6619167&rgt=127.0187702' },
  '종로구':  { cortarNo: '1111000000', coords: '&z=13&btm=37.5401246&lft=126.9123428&top=37.6584939&rgt=127.0915572' },
  '중구':    { cortarNo: '1114000000', coords: '&z=13&btm=37.5086596&lft=126.9122398&top=37.6271234&rgt=127.0914542' },
  '중랑구':  { cortarNo: '1126000000', coords: '&z=13&btm=37.5467206&lft=126.9890098&top=37.6651036&rgt=127.1682242' },
}

const TRADE_CODE_MAP: Record<string, string> = {
  '매매': 'A1',
  '전세': 'B1',
  '월세': 'B2',
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function buildHeaders(): HeadersInit {
  return {
    'User-Agent': UA,
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': `${BASE_URL}/map/37.5665:126.978:13/APT`,
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  }
}

interface NaverArticle {
  atclNo: string
  atclNm: string
  tradTpCd: string
  tradTpNm: string
  rletTpNm: string
  spc1: number
  spc2: number
  prc: string
  hanPrc: string
  rentPrc: string
  lat: number
  lng: number
  flrInfo: string
  atclCfmYmd: string
  tagList: string[]
  cortarNo: string
}

export interface NaverListing {
  atclNo: string
  atclNm: string
  tradeType: string
  propertyType: string
  exclusiveArea: number
  supplyArea: number
  pyeong: number
  sizeType: string
  price: number
  priceDisplay: string
  rentPrice: number | null
  floorInfo: string | null
  confirmDate: string | null
  tags: string[]
  lat: number
  lng: number
  naverUrl: string
}

function parseKoreanPrice(priceStr: string): number {
  if (!priceStr) return 0
  const cleaned = priceStr.replace(/,/g, '').trim()
  const eokMatch = cleaned.match(/(\d+)\s*억\s*(\d*)/)
  if (eokMatch) {
    const eok = parseInt(eokMatch[1], 10) * 10000
    const remainder = eokMatch[2] ? parseInt(eokMatch[2], 10) : 0
    return eok + remainder
  }
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? 0 : num
}

function classifySizeType(spc1: number): string {
  if (spc1 < 66) return '소형'
  if (spc1 < 99) return '20평대'
  if (spc1 < 132) return '30평대'
  return '중대형'
}

function mapArticle(art: NaverArticle): NaverListing {
  const spc1 = Number(art.spc1) || 0
  const prc = art.hanPrc || art.prc || ''
  return {
    atclNo: art.atclNo,
    atclNm: art.atclNm || '',
    tradeType: art.tradTpNm || '',
    propertyType: art.rletTpNm || '',
    exclusiveArea: spc1,
    supplyArea: Number(art.spc2) || 0,
    pyeong: Math.round(spc1 / 3.3058 * 10) / 10,
    sizeType: classifySizeType(spc1),
    price: parseKoreanPrice(prc),
    priceDisplay: prc,
    rentPrice: art.rentPrc ? parseKoreanPrice(art.rentPrc) : null,
    floorInfo: art.flrInfo || null,
    confirmDate: art.atclCfmYmd || null,
    tags: art.tagList || [],
    lat: Number(art.lat) || 0,
    lng: Number(art.lng) || 0,
    naverUrl: `https://m.land.naver.com/article/info/${art.atclNo}`,
  }
}

export async function fetchArticles(
  districtName: string,
  options: {
    tradeTypes?: string[]
    propertyType?: string
    sort?: string
    limit?: number
  } = {}
): Promise<NaverListing[]> {
  const district = SEOUL_COORDS[districtName]
  if (!district) {
    throw new Error(`지원하지 않는 지역입니다: ${districtName}`)
  }

  const tradTpCd = (options.tradeTypes || ['매매'])
    .map(t => TRADE_CODE_MAP[t] || 'A1')
    .join(':')

  const rletTpCd = options.propertyType || 'APT:JGC'
  const sort = options.sort || 'rank'
  const limit = options.limit || 500

  const allArticles: NaverListing[] = []
  let page = 1

  while (allArticles.length < limit && page <= 20) {
    const url = `${ARTICLE_LIST_URL}?rletTpCd=${rletTpCd}&tradTpCd=${tradTpCd}${district.coords}&cortarNo=${district.cortarNo}&sort=${sort}&page=${page}`

    try {
      const res = await fetch(url, {
        headers: buildHeaders(),
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) break

      const data = await res.json()
      const body = data?.body || []

      if (body.length === 0) break

      allArticles.push(...body.map(mapArticle))
      page++

      // 간단한 딜레이 (Vercel에서는 짧게)
      if (page > 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    } catch {
      break
    }
  }

  return allArticles.slice(0, limit)
}

export async function searchComplexByName(
  complexName: string,
  options: {
    tradeTypes?: string[]
  } = {}
): Promise<NaverListing[]> {
  // Step 1: 검색 리다이렉트로 hscpNo 찾기
  const searchUrl = `${SEARCH_URL}/${encodeURIComponent(complexName)}`

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html',
        'Referer': BASE_URL,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })

    let hscpNo: string | null = null

    if (res.status === 302) {
      const location = res.headers.get('location') || ''
      const match = location.match(/\/complex\/info\/(\d+)/)
      if (match) hscpNo = match[1]
    } else if (res.status === 200) {
      const html = await res.text()
      const match = html.match(/\/complex\/info\/(\d+)/)
      if (match) hscpNo = match[1]
    }

    if (!hscpNo) return []

    // Step 2: 단지 매물 조회
    const tradTpCd = (options.tradeTypes || ['매매'])
      .map(t => TRADE_CODE_MAP[t] || 'A1')
      .join(':')

    const articleUrl = `${COMPLEX_ARTICLE_URL}?hscpNo=${hscpNo}&tradTpCd=${tradTpCd}&order=point_&page=1`

    const articleRes = await fetch(articleUrl, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(8000),
    })

    if (!articleRes.ok) return []

    const data = await articleRes.json()
    const articles = data?.result?.list || []

    return articles.map((art: NaverArticle) => mapArticle(art))
  } catch {
    return []
  }
}

export function getDistrictNames(): string[] {
  return Object.keys(SEOUL_COORDS)
}

export function isKnownDistrict(name: string): boolean {
  return name in SEOUL_COORDS
}
