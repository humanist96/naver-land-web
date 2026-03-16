'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatPriceShort } from '@/domain/price'

interface Props {
  data: { tradeType: string; avgPrice: number; avgPriceDisplay: string; count: number }[] | null
}

export function TradeCompareChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400">거래유형 비교 데이터가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">거래유형별 평균 가격</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            tickFormatter={(v: number) => formatPriceShort(v)}
          />
          <YAxis
            type="category"
            dataKey="tradeType"
            tick={{ fontSize: 13 }}
            stroke="#9ca3af"
            width={50}
          />
          <Tooltip
            formatter={(value) => [formatPriceShort(Number(value)), '평균 가격']}
          />
          <Bar dataKey="avgPrice" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
