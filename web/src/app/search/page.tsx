'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { NavBar } from '@/components/layout/NavBar'
import { CITIES, SEOUL_DISTRICTS, TRADE_TYPES, SIZE_TYPES, SORT_OPTIONS } from '@/domain/district'
import { formatPriceShort } from '@/domain/price'
import type { Listing, SearchMeta } from '@/types/listing'
import type { ApiResponse } from '@/types/api'

export default function SearchPage() {
  const [nlqQuery, setNlqQuery] = useState('')
  const [city, setCity] = useState('서울시')
  const [district, setDistrict] = useState('')
  const [selectedTrades, setSelectedTrades] = useState<string[]>(['매매'])
  const [sizeType, setSizeType] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('rank')
  const [listings, setListings] = useState<Listing[]>([])
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  function toggleTrade(trade: string) {
    setSelectedTrades(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    )
  }

  async function handleNlqSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!nlqQuery.trim()) return

    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/search/nlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nlqQuery }),
      })
      const data: ApiResponse<{ listings: Listing[]; parsed: Record<string, unknown> }> = await res.json()
      if (data.success && data.data) {
        setListings(data.data.listings)
        setMeta({
          total: data.data.listings.length,
          district: '',
          city: '',
          avgPrice: 0,
          avgPriceDisplay: '',
        })
        setCurrentPage(1)
      } else {
        setError(data.error?.message || '검색에 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFilterSearch() {
    if (!district) {
      setError('지역을 선택해주세요.')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        district,
        city,
        tradeTypes: selectedTrades.join(','),
        sort,
      })
      if (sizeType) params.set('sizeType', sizeType)
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)

      const res = await fetch(`/api/search/region?${params}`)
      const data: ApiResponse<{ listings: Listing[]; meta: SearchMeta }> = await res.json()

      if (data.success && data.data) {
        let filtered = data.data.listings
        if (sizeType) {
          filtered = filtered.filter(l => l.sizeType === sizeType)
        }
        if (minPrice) {
          const min = parseInt(minPrice, 10) * 10000
          filtered = filtered.filter(l => l.price >= min)
        }
        if (maxPrice) {
          const max = parseInt(maxPrice, 10) * 10000
          filtered = filtered.filter(l => l.price <= max)
        }
        setListings(filtered)
        setMeta({ ...data.data.meta, total: filtered.length })
        setCurrentPage(1)
      } else {
        setError(data.error?.message || '검색에 실패했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleReset() {
    setCity('서울시')
    setDistrict('')
    setSelectedTrades(['매매'])
    setSizeType('')
    setMinPrice('')
    setMaxPrice('')
    setSort('rank')
    setNlqQuery('')
    setListings([])
    setMeta(null)
    setError('')
  }

  const pagedListings = listings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  const totalPages = Math.ceil(listings.length / pageSize)

  return (
    <AuthGuard requireApproved>
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* NLQ Search Bar */}
        <form onSubmit={handleNlqSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={nlqQuery}
              onChange={e => setNlqQuery(e.target.value)}
              placeholder="자연어 검색: 강남 30평대 매매 10억 이하"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isLoading ? '검색 중...' : '검색'}
            </button>
          </div>
        </form>

        {/* Filter Panel */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지역</label>
              <div className="flex gap-2">
                <select
                  value={city}
                  onChange={e => { setCity(e.target.value); setDistrict('') }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {CITIES.map(c => (
                    <option key={c.code} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">구/군 선택</option>
                  {city === '서울시' && SEOUL_DISTRICTS.map(d => (
                    <option key={d.code} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">거래유형</label>
              <div className="flex gap-2">
                {TRADE_TYPES.map(tt => (
                  <button
                    key={tt.code}
                    type="button"
                    onClick={() => toggleTrade(tt.name)}
                    className={`px-3 py-2 text-sm rounded-lg border ${
                      selectedTrades.includes(tt.name)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tt.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">평형</label>
              <select
                value={sizeType}
                onChange={e => setSizeType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">전체</option>
                {SIZE_TYPES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가격 (억)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  placeholder="최소"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-400">~</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  placeholder="최대"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">정렬:</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                {SORT_OPTIONS.map(so => (
                  <option key={so.value} value={so.value}>{so.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                초기화
              </button>
              <button
                onClick={handleFilterSearch}
                disabled={isLoading}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                검색
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Search Summary */}
        {meta && (
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
            <span>총 <strong className="text-gray-900">{meta.total.toLocaleString()}</strong>건</span>
            {meta.avgPrice > 0 && (
              <span>평균 <strong className="text-gray-900">{formatPriceShort(meta.avgPrice)}</strong></span>
            )}
            {meta.district && <span>{meta.city} {meta.district} 기준</span>}
          </div>
        )}

        {/* Results Table */}
        {pagedListings.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">단지명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">거래</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">면적</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">분류</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가격</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">층</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">확인일</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">링크</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pagedListings.map(listing => (
                    <tr key={listing.atclNo} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {listing.atclNm}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{listing.tradeType}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {listing.pyeong.toFixed(1)}평
                        <span className="text-xs text-gray-400 ml-1">({listing.exclusiveArea}㎡)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {listing.sizeType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {listing.priceDisplay}
                        {listing.rentPrice != null && listing.rentPrice > 0 && (
                          <span className="text-gray-500">/{listing.rentPrice}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{listing.floorInfo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {listing.confirmDate
                          ? `${listing.confirmDate.slice(4, 6)}/${listing.confirmDate.slice(6, 8)}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={listing.naverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          보기
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-200">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  이전
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                  const page = start + i
                  if (page > totalPages) return null
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && listings.length === 0 && meta && (
          <div className="text-center py-12 text-gray-500">
            검색 결과가 없습니다. 조건을 변경해보세요.
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
