'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardOverview, PriceTrendData, SizeDistributionData } from '@/types/dashboard'
import type { ListingChange } from '@/types/listing'
import type { ApiResponse } from '@/types/api'

interface UseDashboardOptions {
  districtCode: string
  tradeType?: string
  period?: string
}

interface DashboardData {
  overview: DashboardOverview | null
  priceTrend: PriceTrendData | null
  listingChanges: { labels: string[]; newCounts: number[]; removedCounts: number[] } | null
  sizeDistribution: SizeDistributionData[] | null
  tradeComparison: { tradeType: string; avgPrice: number; avgPriceDisplay: string; count: number }[] | null
  recentChanges: { changes: ListingChange[]; summary: Record<string, number> } | null
  isLoading: boolean
  error: string | null
}

export function useDashboard({ districtCode, tradeType = '매매', period = '1m' }: UseDashboardOptions): DashboardData & { refresh: () => void } {
  const [data, setData] = useState<DashboardData>({
    overview: null,
    priceTrend: null,
    listingChanges: null,
    sizeDistribution: null,
    tradeComparison: null,
    recentChanges: null,
    isLoading: false,
    error: null,
  })

  const fetchAll = useCallback(async () => {
    if (!districtCode) return

    setData(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const [overviewRes, trendRes, changesRes, sizeRes, tradeRes, recentRes] = await Promise.allSettled([
        fetch(`/api/dashboard/overview?districtCode=${districtCode}&tradeType=${tradeType}`),
        fetch(`/api/dashboard/price-trend?districtCode=${districtCode}&period=${period}&tradeTypes=매매,전세`),
        fetch(`/api/dashboard/listing-changes?districtCode=${districtCode}&days=7`),
        fetch(`/api/dashboard/size-distribution?districtCode=${districtCode}&tradeType=${tradeType}`),
        fetch(`/api/dashboard/trade-comparison?districtCode=${districtCode}`),
        fetch(`/api/dashboard/recent-changes?districtCode=${districtCode}&limit=20`),
      ])

      const parse = async <T,>(result: PromiseSettledResult<Response>): Promise<T | null> => {
        if (result.status === 'rejected') return null
        const json: ApiResponse<T> = await result.value.json()
        return json.success ? (json.data ?? null) : null
      }

      setData({
        overview: await parse<DashboardOverview>(overviewRes),
        priceTrend: await parse<PriceTrendData>(trendRes),
        listingChanges: await parse<{ labels: string[]; newCounts: number[]; removedCounts: number[] }>(changesRes),
        sizeDistribution: await parse<SizeDistributionData[]>(sizeRes),
        tradeComparison: await parse<{ tradeType: string; avgPrice: number; avgPriceDisplay: string; count: number }[]>(tradeRes),
        recentChanges: await parse<{ changes: ListingChange[]; summary: Record<string, number> }>(recentRes),
        isLoading: false,
        error: null,
      })
    } catch {
      setData(prev => ({ ...prev, isLoading: false, error: '대시보드 데이터를 불러올 수 없습니다.' }))
    }
  }, [districtCode, tradeType, period])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { ...data, refresh: fetchAll }
}
