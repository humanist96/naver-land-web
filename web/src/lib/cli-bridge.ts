import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { SEARCH } from '@/domain/constants'
import type { Listing } from '@/types/listing'
import { parseKoreanPrice } from '@/domain/price'

const execFileAsync = promisify(execFile)

const CLI_DIR = path.resolve(process.cwd(), '..', 'cli-naver-land')
const PYTHON_PATH = process.env.CLI_PYTHON_PATH || 'python3'

interface CliSearchOptions {
  district: string
  city?: string
  tradeTypes?: string[]
  propertyType?: string
  sort?: string
  limit?: number
}

interface CliComplexOptions {
  complexName: string
  district?: string
  city?: string
  tradeTypes?: string[]
}

interface CliRawListing {
  atcl_no: string
  atcl_nm: string
  trad_tp_nm: string
  rlet_tp_nm: string
  cortarNo: string
  spc1: number
  spc2: number
  pyeong: number
  size_type: string
  prc: string
  rent_prc: string | null
  flr_info: string | null
  cfm_ymd: string | null
  tag_list: string[]
  lat: number
  lng: number
}

function sanitizeInput(input: string): string {
  return input.replace(/[;&|`$(){}[\]\\'"<>!#]/g, '').trim()
}

function buildNaverUrl(atclNo: string): string {
  return `https://m.land.naver.com/article/info/${atclNo}`
}

function mapRawToListing(
  raw: CliRawListing,
  districtName: string,
  cityName: string,
  snapshotId: string
): Listing {
  const price = parseKoreanPrice(raw.prc)
  return {
    atclNo: raw.atcl_no,
    atclNm: raw.atcl_nm,
    districtCode: raw.cortarNo,
    districtName,
    cityName,
    tradeType: raw.trad_tp_nm,
    propertyType: raw.rlet_tp_nm,
    exclusiveArea: raw.spc1,
    supplyArea: raw.spc2,
    pyeong: raw.pyeong,
    sizeType: raw.size_type,
    price,
    priceDisplay: raw.prc,
    rentPrice: raw.rent_prc ? parseKoreanPrice(raw.rent_prc) : null,
    floorInfo: raw.flr_info,
    confirmDate: raw.cfm_ymd,
    tags: raw.tag_list || [],
    lat: raw.lat,
    lng: raw.lng,
    naverUrl: buildNaverUrl(raw.atcl_no),
    collectedAt: new Date().toISOString(),
    snapshotId,
  }
}

export async function searchRegion(
  options: CliSearchOptions
): Promise<Listing[]> {
  const args = [
    '-m', 'cli_anything.naver_land',
    '--json',
    'search', 'region',
    '-d', sanitizeInput(options.district),
  ]

  if (options.city) {
    args.push('-c', sanitizeInput(options.city))
  }

  if (options.tradeTypes?.length) {
    for (const tt of options.tradeTypes) {
      args.push('-t', sanitizeInput(tt))
    }
  }

  if (options.propertyType) {
    args.push('--rlet', sanitizeInput(options.propertyType))
  }

  if (options.sort) {
    args.push('--sort', sanitizeInput(options.sort))
  }

  if (options.limit) {
    args.push('--limit', String(options.limit))
  }

  const snapshotId = `snap-${Date.now()}`

  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, args, {
      cwd: CLI_DIR,
      timeout: process.env.CLI_TIMEOUT_MS
        ? parseInt(process.env.CLI_TIMEOUT_MS, 10)
        : SEARCH.CLI_TIMEOUT_MS,
      env: { ...process.env, PYTHONPATH: CLI_DIR },
    })

    const rawListings: CliRawListing[] = JSON.parse(stdout)
    const cityName = options.city || '서울시'
    return rawListings.map(raw =>
      mapRawToListing(raw, options.district, cityName, snapshotId)
    )
  } catch (error) {
    const err = error as Error & { code?: string; killed?: boolean }
    if (err.killed) {
      throw new Error('CLI_TIMEOUT: 검색 시간이 초과되었습니다.')
    }
    if (err.code === 'ENOENT') {
      throw new Error('CLI_NOT_FOUND: Python 또는 CLI가 설치되지 않았습니다.')
    }
    throw new Error(`CLI_ERROR: ${err.message}`)
  }
}

export async function searchComplex(
  options: CliComplexOptions
): Promise<Listing[]> {
  const args = [
    '-m', 'cli_anything.naver_land',
    '--json',
    'search', 'complex',
    '-n', sanitizeInput(options.complexName),
  ]

  if (options.district) {
    args.push('-d', sanitizeInput(options.district))
  }
  if (options.city) {
    args.push('-c', sanitizeInput(options.city))
  }
  if (options.tradeTypes?.length) {
    for (const tt of options.tradeTypes) {
      args.push('-t', sanitizeInput(tt))
    }
  }

  const snapshotId = `snap-${Date.now()}`

  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, args, {
      cwd: CLI_DIR,
      timeout: SEARCH.CLI_TIMEOUT_MS,
      env: { ...process.env, PYTHONPATH: CLI_DIR },
    })

    const rawListings: CliRawListing[] = JSON.parse(stdout)
    return rawListings.map(raw =>
      mapRawToListing(
        raw,
        options.district || '',
        options.city || '',
        snapshotId
      )
    )
  } catch (error) {
    const err = error as Error & { killed?: boolean }
    if (err.killed) {
      throw new Error('CLI_TIMEOUT: 검색 시간이 초과되었습니다.')
    }
    throw new Error(`CLI_ERROR: ${err.message}`)
  }
}

export async function searchNlq(query: string): Promise<{
  listings: Listing[]
  parsed: Record<string, unknown>
}> {
  const args = [
    '-m', 'cli_anything.naver_land',
    '--json',
    'nlq', sanitizeInput(query),
  ]

  const snapshotId = `snap-${Date.now()}`

  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, args, {
      cwd: CLI_DIR,
      timeout: SEARCH.CLI_TIMEOUT_MS,
      env: { ...process.env, PYTHONPATH: CLI_DIR },
    })

    const result = JSON.parse(stdout)

    if (Array.isArray(result)) {
      return {
        listings: result.map(raw =>
          mapRawToListing(raw, '', '', snapshotId)
        ),
        parsed: {},
      }
    }

    const listings = (result.listings || []).map((raw: CliRawListing) =>
      mapRawToListing(raw, '', '', snapshotId)
    )

    return {
      listings,
      parsed: result.parsed || {},
    }
  } catch (error) {
    const err = error as Error & { killed?: boolean }
    if (err.killed) {
      throw new Error('CLI_TIMEOUT: 검색 시간이 초과되었습니다.')
    }
    throw new Error(`CLI_ERROR: ${err.message}`)
  }
}

export async function getCities(): Promise<string[]> {
  const args = [
    '-m', 'cli_anything.naver_land',
    '--json',
    'search', 'cities',
  ]

  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, args, {
      cwd: CLI_DIR,
      timeout: 10000,
      env: { ...process.env, PYTHONPATH: CLI_DIR },
    })
    return JSON.parse(stdout)
  } catch {
    return []
  }
}

export async function getDistricts(city: string): Promise<string[]> {
  const args = [
    '-m', 'cli_anything.naver_land',
    '--json',
    'search', 'districts',
    '-c', sanitizeInput(city),
  ]

  try {
    const { stdout } = await execFileAsync(PYTHON_PATH, args, {
      cwd: CLI_DIR,
      timeout: 10000,
      env: { ...process.env, PYTHONPATH: CLI_DIR },
    })
    return JSON.parse(stdout)
  } catch {
    return []
  }
}
