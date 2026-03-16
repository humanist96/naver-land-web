export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    total: number
    page: number
    limit: number
  }
}

export interface CollectionJob {
  id: string
  districtCode: string
  districtName: string
  cityName: string
  tradeTypes: string[]
  propertyTypes: string[]
  schedule: string
  isActive: boolean
  lastRunAt: string | null
  lastStatus: 'success' | 'failed' | 'running' | null
  lastError: string | null
  totalCount: number | null
  changeCount: number | null
  createdBy: string
  createdAt: string
}
