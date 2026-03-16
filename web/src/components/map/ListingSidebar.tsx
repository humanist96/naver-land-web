'use client'

import { useState } from 'react'
import type { Listing } from '@/types/listing'
import { formatPriceShort } from '@/domain/price'

interface Props {
  listings: Listing[]
  total: number
  avgPrice: number
  isLoading: boolean
  selectedAtclNo: string | null
  onSelect: (listing: Listing) => void
  onSearch: (params: { district: string; tradeTypes: string[]; nlq?: string }) => void
}

const TRADE_BADGE: Record<string, string> = {
  '매매': 'bg-blue-100 text-blue-700',
  '전세': 'bg-green-100 text-green-700',
  '월세': 'bg-orange-100 text-orange-700',
}

export function ListingSidebar({
  listings,
  total,
  avgPrice,
  isLoading,
  selectedAtclNo,
  onSelect,
  onSearch,
}: Props) {
  const [nlqQuery, setNlqQuery] = useState('')
  const [district, setDistrict] = useState('강남구')
  const [tradeTypes, setTradeTypes] = useState<string[]>(['매매'])

  function toggleTrade(t: string) {
    setTradeTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  function handleNlqSearch(e: React.FormEvent) {
    e.preventDefault()
    if (nlqQuery.trim()) {
      onSearch({ district: '', tradeTypes: [], nlq: nlqQuery.trim() })
    }
  }

  function handleFilterSearch() {
    onSearch({ district, tradeTypes })
  }

  return (
    <div className="w-[360px] h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* 검색바 */}
      <div className="p-3 border-b border-gray-200">
        <form onSubmit={handleNlqSearch}>
          <div className="flex gap-2">
            <input
              type="text"
              value={nlqQuery}
              onChange={e => setNlqQuery(e.target.value)}
              placeholder="강남 30평대 매매 10억 이하"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              검색
            </button>
          </div>
        </form>
      </div>

      {/* 필터 */}
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex gap-2 items-center">
          <select
            value={district}
            onChange={e => setDistrict(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
          >
            {[
              '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
              '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
              '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구',
            ].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            onClick={handleFilterSearch}
            disabled={isLoading}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            조회
          </button>
        </div>
        <div className="flex gap-1.5">
          {['매매', '전세', '월세'].map(t => (
            <button
              key={t}
              onClick={() => toggleTrade(t)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                tradeTypes.includes(t)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-4 text-xs text-gray-600">
        <span>총 <strong className="text-gray-900">{total.toLocaleString()}</strong>건</span>
        {avgPrice > 0 && (
          <span>평균 <strong className="text-gray-900">{formatPriceShort(avgPrice)}</strong></span>
        )}
        {isLoading && <span className="text-blue-600">로딩 중...</span>}
      </div>

      {/* 매물 카드 목록 */}
      <div className="flex-1 overflow-y-auto">
        {listings.length === 0 && !isLoading && (
          <div className="p-8 text-center text-gray-400 text-sm">
            지역을 선택하고 조회해주세요
          </div>
        )}
        {listings.map(listing => (
          <div
            key={listing.atclNo}
            onClick={() => onSelect(listing)}
            className={`px-3 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-blue-50 ${
              selectedAtclNo === listing.atclNo ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {listing.atclNm}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    TRADE_BADGE[listing.tradeType] || 'bg-gray-100 text-gray-600'
                  }`}>
                    {listing.tradeType}
                  </span>
                  <span className="text-xs text-gray-500">
                    {listing.pyeong.toFixed(0)}평 ({listing.exclusiveArea}㎡)
                  </span>
                  <span className="text-xs text-gray-400">{listing.sizeType}</span>
                </div>
              </div>
              <div className="text-right ml-2">
                <p className="text-sm font-bold text-gray-900">
                  {listing.priceDisplay}
                </p>
                {listing.rentPrice != null && listing.rentPrice > 0 && (
                  <p className="text-xs text-gray-500">/{listing.rentPrice}만</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
              {listing.floorInfo && <span>{listing.floorInfo}층</span>}
              {listing.confirmDate && (
                <span>{listing.confirmDate.slice(4, 6)}/{listing.confirmDate.slice(6, 8)}</span>
              )}
              {listing.tags?.slice(0, 2).map(tag => (
                <span key={tag} className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
