'use client'

import type { ListingChange } from '@/types/listing'
import { formatPriceShort } from '@/domain/price'

interface Props {
  data: { changes: ListingChange[]; summary: Record<string, number> } | null
}

const changeTypeLabels: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: '신규', color: 'text-green-700', bg: 'bg-green-100' },
  removed: { label: '삭제', color: 'text-red-700', bg: 'bg-red-100' },
  price_up: { label: '상승', color: 'text-orange-700', bg: 'bg-orange-100' },
  price_down: { label: '하락', color: 'text-blue-700', bg: 'bg-blue-100' },
}

export function RecentChanges({ data }: Props) {
  if (!data || data.changes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">최근 변동 매물</h3>
        <p className="text-gray-400 text-center py-8">변동 데이터가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">최근 변동 매물</h3>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>신규 <strong className="text-green-600">{data.summary.new || 0}</strong></span>
          <span>삭제 <strong className="text-red-600">{data.summary.removed || 0}</strong></span>
          <span>상승 <strong className="text-orange-600">{data.summary.price_up || 0}</strong></span>
          <span>하락 <strong className="text-blue-600">{data.summary.price_down || 0}</strong></span>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data.changes.map(change => {
          const style = changeTypeLabels[change.changeType] || changeTypeLabels.new
          return (
            <div
              key={`${change.atclNo}-${change.detectedAt}`}
              className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.color}`}>
                  {style.label}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{change.atclNm || change.atclNo}</p>
                  <p className="text-xs text-gray-500">{change.tradeType}</p>
                </div>
              </div>
              <div className="text-right">
                {(change.changeType === 'price_up' || change.changeType === 'price_down') && (
                  <>
                    <p className="text-sm font-medium text-gray-900">
                      {change.newPrice ? formatPriceShort(change.newPrice) : '-'}
                    </p>
                    <p className={`text-xs ${change.changeType === 'price_up' ? 'text-red-500' : 'text-blue-500'}`}>
                      {change.priceDiffPercent != null
                        ? `${change.priceDiffPercent > 0 ? '+' : ''}${change.priceDiffPercent}%`
                        : ''}
                    </p>
                  </>
                )}
                {change.changeType === 'new' && change.newPrice && (
                  <p className="text-sm font-medium text-gray-900">{formatPriceShort(change.newPrice)}</p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(change.detectedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
