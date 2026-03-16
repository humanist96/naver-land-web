'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  data: { labels: string[]; newCounts: number[]; removedCounts: number[] } | null
}

export function ListingChangeChart({ data }: Props) {
  if (!data || data.labels.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400">매물 증감 데이터가 없습니다</p>
      </div>
    )
  }

  const chartData = data.labels.map((label, i) => ({
    date: label.slice(5),
    신규: data.newCounts[i] || 0,
    삭제: -(data.removedCounts[i] || 0),
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">매물 증감</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip />
          <Legend />
          <Bar dataKey="신규" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="삭제" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
