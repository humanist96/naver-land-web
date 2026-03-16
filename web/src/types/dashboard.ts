export interface MarketSnapshot {
  id: string
  districtCode: string
  districtName: string
  snapshotDate: string
  tradeType: string
  totalCount: number
  avgPrice: number
  medianPrice: number
  minPrice: number
  maxPrice: number
  sizeDistribution: {
    small: number
    twenty: number
    thirty: number
    large: number
  }
  newCount: number
  removedCount: number
  priceUpCount: number
  priceDownCount: number
  snapshotId: string
  createdAt: string
}

export interface DashboardOverview {
  current: {
    totalCount: number
    avgPrice: number
    avgPriceDisplay: string
    medianPrice: number
    newToday: number
    removedToday: number
  }
  previous: {
    totalCount: number
    avgPrice: number
  }
  changes: {
    countDiff: number
    countDiffPercent: number
    priceDiff: number
    priceDiffPercent: number
  }
}

export interface PriceTrendData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    unit: string
  }>
}

export interface SizeDistributionData {
  name: string
  value: number
  percentage: number
}
