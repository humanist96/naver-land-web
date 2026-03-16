'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { SizeDistributionData } from '@/types/dashboard'

interface Props {
  data: SizeDistributionData[] | null
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

export function SizeDistChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400">평형 분포 데이터가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">평형 분포</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
            label={({ name, payload }) => `${name} ${(payload as SizeDistributionData)?.percentage ?? ''}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${value}건`, String(name)]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
