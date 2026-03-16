'use client'

import { useState, useCallback } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { NavBar } from '@/components/layout/NavBar'
import { KakaoMapProvider } from '@/components/map/KakaoMapProvider'
import { NaverLandMap } from '@/components/map/NaverLandMap'
import { ListingSidebar } from '@/components/map/ListingSidebar'
import { ListingDetail } from '@/components/map/ListingDetail'
import type { Listing } from '@/types/listing'
import type { ApiResponse } from '@/types/api'

// 서울 구별 중심 좌표
const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  '강남구': { lat: 37.5172, lng: 127.0473 },
  '강동구': { lat: 37.5301, lng: 127.1238 },
  '강북구': { lat: 37.6397, lng: 127.0255 },
  '강서구': { lat: 37.5510, lng: 126.8495 },
  '관악구': { lat: 37.4813, lng: 126.9516 },
  '광진구': { lat: 37.5385, lng: 127.0824 },
  '구로구': { lat: 37.4955, lng: 126.8875 },
  '금천구': { lat: 37.4519, lng: 126.9020 },
  '노원구': { lat: 37.6543, lng: 127.0564 },
  '도봉구': { lat: 37.6688, lng: 127.0471 },
  '동대문구': { lat: 37.5744, lng: 127.0400 },
  '동작구': { lat: 37.5124, lng: 126.9395 },
  '마포구': { lat: 37.5638, lng: 126.9084 },
  '서대문구': { lat: 37.5791, lng: 126.9368 },
  '서초구': { lat: 37.4837, lng: 127.0324 },
  '성동구': { lat: 37.5634, lng: 127.0370 },
  '성북구': { lat: 37.5894, lng: 127.0164 },
  '송파구': { lat: 37.5146, lng: 127.1059 },
  '양천구': { lat: 37.5170, lng: 126.8667 },
  '영등포구': { lat: 37.5264, lng: 126.8963 },
  '용산구': { lat: 37.5384, lng: 126.9654 },
  '은평구': { lat: 37.6027, lng: 126.9291 },
  '종로구': { lat: 37.5735, lng: 126.9790 },
  '중구': { lat: 37.5641, lng: 126.9979 },
  '중랑구': { lat: 37.6066, lng: 127.0927 },
}

export default function SearchPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [avgPrice, setAvgPrice] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [selectedAtclNo, setSelectedAtclNo] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.978 })
  const [mapZoom, setMapZoom] = useState(11)

  const handleSearch = useCallback(async (params: { district: string; tradeTypes: string[]; nlq?: string }) => {
    setIsLoading(true)
    setSelectedListing(null)
    setSelectedAtclNo(null)

    try {
      if (params.nlq) {
        // 자연어 검색
        const res = await fetch('/api/search/nlq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: params.nlq }),
        })
        const data: ApiResponse<{ listings: Listing[]; parsed: Record<string, unknown>; meta: { total: number; avgPrice: number } }> = await res.json()
        if (data.success && data.data) {
          setListings(data.data.listings)
          setTotal(data.data.meta.total)
          setAvgPrice(data.data.meta.avgPrice)

          // 파싱된 지역으로 지도 이동
          const parsed = data.data.parsed as { districtName?: string }
          if (parsed.districtName && DISTRICT_CENTERS[parsed.districtName]) {
            setMapCenter(DISTRICT_CENTERS[parsed.districtName])
            setMapZoom(5)
          }
        }
      } else {
        // 필터 검색
        const qs = new URLSearchParams({
          district: params.district,
          tradeTypes: params.tradeTypes.join(','),
        })
        const res = await fetch(`/api/search/region?${qs}`)
        const data: ApiResponse<{ listings: Listing[]; meta: { total: number; avgPrice: number } }> = await res.json()
        if (data.success && data.data) {
          setListings(data.data.listings)
          setTotal(data.data.meta.total)
          setAvgPrice(data.data.meta.avgPrice)

          // 해당 구로 지도 이동
          if (DISTRICT_CENTERS[params.district]) {
            setMapCenter(DISTRICT_CENTERS[params.district])
            setMapZoom(5)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleMarkerClick = useCallback((listing: Listing) => {
    setSelectedListing(listing)
    setSelectedAtclNo(listing.atclNo)
  }, [])

  const handleSidebarSelect = useCallback((listing: Listing) => {
    setSelectedListing(listing)
    setSelectedAtclNo(listing.atclNo)
  }, [])

  return (
    <AuthGuard requireApproved>
      <KakaoMapProvider>
        <div className="h-screen flex flex-col">
          <NavBar />
          <div className="flex-1 flex relative overflow-hidden">
            {/* 좌측 사이드바 */}
            <ListingSidebar
              listings={listings}
              total={total}
              avgPrice={avgPrice}
              isLoading={isLoading}
              selectedAtclNo={selectedAtclNo}
              onSelect={handleSidebarSelect}
              onSearch={handleSearch}
            />

            {/* 우측 지도 */}
            <div className="flex-1 relative">
              <NaverLandMap
                listings={listings}
                center={mapCenter}
                zoom={mapZoom}
                onMarkerClick={handleMarkerClick}
                selectedAtclNo={selectedAtclNo}
              />
            </div>

            {/* 매물 상세 팝업 */}
            <ListingDetail
              listing={selectedListing}
              onClose={() => {
                setSelectedListing(null)
                setSelectedAtclNo(null)
              }}
            />
          </div>
        </div>
      </KakaoMapProvider>
    </AuthGuard>
  )
}
