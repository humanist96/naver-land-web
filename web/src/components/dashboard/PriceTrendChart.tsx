'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { PriceTrendData } from '@/types/dashboard'
import { formatPriceShort } from '@/domain/price'

interface Props {
  data: PriceTrendData | null
}

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626']

export function PriceTrendChart({ data }: Props) {
  if (!data || data.labels.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400">가격 추이 데이터가 없습니다</p>
      </div>
    )
  }

  const chartData = data.labels.map((label, i) => {
    const point: Record<string, string | number> = {
      date: label.slice(5),
    }
    for (const ds of data.datasets) {
      point[ds.label] = ds.data[i] || 0
    }
    return point
  })

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">가격 추이</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            tickFormatter={(v: number) => formatPriceShort(v)}
          />
          <Tooltip
            formatter={(value, name) => [formatPriceShort(Number(value)), String(name)]}
            labelFormatter={(label) => `날짜: ${String(label)}`}
          />
          <Legend />
          {data.datasets.map((ds, i) => (
            <Line
              key={ds.label}
              type="monotone"
              dataKey={ds.label}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
