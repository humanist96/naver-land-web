'use client'

import type { DashboardOverview } from '@/types/dashboard'

interface Props {
  data: DashboardOverview | null
}

interface CardProps {
  label: string
  value: string | number
  subValue?: string
  isPositive?: boolean | null
}

function StatCard({ label, value, subValue, isPositive }: CardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {value}
      </p>
      {subValue && (
        <p className={`text-sm mt-1 ${
          isPositive === true ? 'text-green-600' :
          isPositive === false ? 'text-red-600' :
          'text-gray-400'
        }`}>
          {subValue}
        </p>
      )}
    </div>
  )
}

export function OverviewCards({ data }: Props) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['총 매물', '평균 가격', '신규 매물', '삭제 매물'].map(label => (
          <StatCard key={label} label={label} value="--" subValue="데이터 수집 중" />
        ))}
      </div>
    )
  }

  const { current, changes } = data

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="총 매물"
        value={current.totalCount.toLocaleString()}
        subValue={changes.countDiff !== 0
          ? `${changes.countDiff > 0 ? '+' : ''}${changes.countDiff} (${changes.countDiffPercent > 0 ? '+' : ''}${changes.countDiffPercent}%)`
          : '변동 없음'}
        isPositive={changes.countDiff > 0 ? true : changes.countDiff < 0 ? false : null}
      />
      <StatCard
        label="평균 가격"
        value={current.avgPriceDisplay}
        subValue={changes.priceDiff !== 0
          ? `${changes.priceDiffPercent > 0 ? '+' : ''}${changes.priceDiffPercent}%`
          : '변동 없음'}
        isPositive={changes.priceDiff > 0 ? false : changes.priceDiff < 0 ? true : null}
      />
      <StatCard
        label="신규 매물"
        value={`+${current.newToday}`}
        subValue="오늘"
        isPositive={true}
      />
      <StatCard
        label="삭제 매물"
        value={`-${current.removedToday}`}
        subValue="오늘"
        isPositive={false}
      />
    </div>
  )
}
