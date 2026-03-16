'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { NavBar } from '@/components/layout/NavBar'
import { DashboardFilter } from '@/components/dashboard/DashboardFilter'
import { OverviewCards } from '@/components/dashboard/OverviewCards'
import { PriceTrendChart } from '@/components/dashboard/PriceTrendChart'
import { ListingChangeChart } from '@/components/dashboard/ListingChangeChart'
import { SizeDistChart } from '@/components/dashboard/SizeDistChart'
import { TradeCompareChart } from '@/components/dashboard/TradeCompareChart'
import { RecentChanges } from '@/components/dashboard/RecentChanges'
import { useDashboard } from '@/hooks/useDashboard'

export default function DashboardPage() {
  const [city, setCity] = useState('서울시')
  const [districtCode, setDistrictCode] = useState('')
  const [period, setPeriod] = useState('1m')

  const dashboard = useDashboard({
    districtCode,
    tradeType: '매매',
    period,
  })

  return (
    <AuthGuard requireApproved>
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">시장 대시보드</h1>
          {dashboard.isLoading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          )}
        </div>

        <DashboardFilter
          city={city}
          districtCode={districtCode}
          period={period}
          onCityChange={setCity}
          onDistrictChange={setDistrictCode}
          onPeriodChange={setPeriod}
        />

        {!districtCode ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <p className="text-blue-800 font-medium">지역을 선택해주세요</p>
            <p className="text-sm text-blue-600 mt-1">
              시/도와 구/군을 선택하면 해당 지역의 시장 동향을 확인할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            {dashboard.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {dashboard.error}
              </div>
            )}

            {/* 시장 개요 카드 */}
            <OverviewCards data={dashboard.overview} />

            {/* 가격 추이 + 매물 증감 (2열) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <PriceTrendChart data={dashboard.priceTrend} />
              <ListingChangeChart data={dashboard.listingChanges} />
            </div>

            {/* 평형 분포 + 거래유형 비교 (2열) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <SizeDistChart data={dashboard.sizeDistribution} />
              <TradeCompareChart data={dashboard.tradeComparison} />
            </div>

            {/* 최근 변동 매물 */}
            <div className="mt-6">
              <RecentChanges data={dashboard.recentChanges} />
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  )
}
