export interface SavedSearch {
  id: string
  userId: string
  name: string
  queryParams: {
    cityName?: string
    districtName?: string
    complexName?: string
    tradeTypes?: string[]
    sizeType?: string
    minPrice?: number
    maxPrice?: number
    sort?: string
    nlqText?: string
  }
  createdAt: string
}
