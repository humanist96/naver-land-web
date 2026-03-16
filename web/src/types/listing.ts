export interface Listing {
  atclNo: string
  atclNm: string
  districtCode: string
  districtName: string
  cityName: string
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
  collectedAt: string
  snapshotId: string
}

export interface ListingChange {
  id: string
  atclNo: string
  atclNm: string
  changeType: 'new' | 'removed' | 'price_up' | 'price_down'
  oldPrice: number | null
  newPrice: number | null
  priceDiff: number | null
  priceDiffPercent: number | null
  districtCode: string
  districtName: string
  tradeType: string
  detectedAt: string
  snapshotId: string
}

export interface SearchParams {
  district?: string
  city?: string
  tradeTypes?: string[]
  propertyType?: string
  sizeType?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  limit?: number
}

export interface NlqSearchRequest {
  query: string
}

export interface SearchMeta {
  total: number
  district: string
  city: string
  avgPrice: number
  avgPriceDisplay: string
}
