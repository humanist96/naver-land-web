'use client'

import { CITIES, SEOUL_DISTRICTS } from '@/domain/district'

interface Props {
  city: string
  districtCode: string
  period: string
  onCityChange: (city: string) => void
  onDistrictChange: (code: string) => void
  onPeriodChange: (period: string) => void
}

const PERIODS = [
  { value: '1w', label: '1주' },
  { value: '1m', label: '1개월' },
  { value: '3m', label: '3개월' },
  { value: '6m', label: '6개월' },
  { value: '1y', label: '1년' },
]

export function DashboardFilter({
  city,
  districtCode,
  period,
  onCityChange,
  onDistrictChange,
  onPeriodChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <label className="text-sm text-gray-600">지역:</label>
      <select
        value={city}
        onChange={e => { onCityChange(e.target.value); onDistrictChange('') }}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
      >
        {CITIES.map(c => (
          <option key={c.code} value={c.name}>{c.name}</option>
        ))}
      </select>
      <select
        value={districtCode}
        onChange={e => onDistrictChange(e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
      >
        <option value="">구/군 선택</option>
        {city === '서울시' && SEOUL_DISTRICTS.map(d => (
          <option key={d.code} value={`${d.cityCode}${d.code}00000`}>{d.name}</option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2">
        <label className="text-sm text-gray-600">기간:</label>
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          {PERIODS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
