'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useKakaoMap } from './KakaoMapProvider'
import type { Listing } from '@/types/listing'
import { formatPriceShort } from '@/domain/price'

interface Props {
  listings: Listing[]
  center?: { lat: number; lng: number }
  zoom?: number
  onMarkerClick?: (listing: Listing) => void
  selectedAtclNo?: string | null
}

const TRADE_COLORS: Record<string, string> = {
  '매매': '#2563eb',
  '전세': '#059669',
  '월세': '#d97706',
}

export function NaverLandMap({
  listings,
  center = { lat: 37.5665, lng: 126.978 },
  zoom = 11,
  onMarkerClick,
  selectedAtclNo,
}: Props) {
  const { isLoaded } = useKakaoMap()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const clustererRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])

  const clearOverlays = useCallback(() => {
    overlaysRef.current.forEach((o: { setMap: (m: unknown) => void }) => o.setMap(null))
    overlaysRef.current = []
    if (clustererRef.current) {
      clustererRef.current.clear()
    }
  }, [])

  // 지도 초기화
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return

    const kakao = window.kakao
    const mapOptions = {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: zoom,
    }
    const map = new kakao.maps.Map(mapContainerRef.current, mapOptions)
    mapRef.current = map

    // 클러스터러 생성
    clustererRef.current = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 5,
      disableClickZoom: false,
      styles: [
        {
          width: '52px', height: '52px',
          background: 'rgba(37, 99, 235, 0.85)',
          borderRadius: '50%',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '52px',
          fontSize: '14px',
          fontWeight: 'bold',
        },
        {
          width: '60px', height: '60px',
          background: 'rgba(37, 99, 235, 0.85)',
          borderRadius: '50%',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '60px',
          fontSize: '15px',
          fontWeight: 'bold',
        },
        {
          width: '70px', height: '70px',
          background: 'rgba(37, 99, 235, 0.9)',
          borderRadius: '50%',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '70px',
          fontSize: '16px',
          fontWeight: 'bold',
        },
      ],
    })
  }, [isLoaded, center.lat, center.lng, zoom])

  // 매물 마커 표시
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return

    clearOverlays()

    const kakao = window.kakao
    const map = mapRef.current
    const markers: any[] = []

    for (const listing of listings) {
      if (!listing.lat || !listing.lng) continue

      const color = TRADE_COLORS[listing.tradeType] || '#6b7280'
      const isSelected = listing.atclNo === selectedAtclNo
      const priceText = formatPriceShort(listing.price)

      // 커스텀 오버레이 (가격 라벨 마커)
      const content = document.createElement('div')
      content.innerHTML = `
        <div style="
          cursor: pointer;
          padding: 4px 8px;
          background: ${isSelected ? '#1e40af' : color};
          color: white;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid ${isSelected ? '#fff' : 'transparent'};
          transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
          transition: transform 0.2s;
        ">
          ${priceText}
        </div>
      `

      content.addEventListener('click', () => {
        onMarkerClick?.(listing)
      })

      const position = new kakao.maps.LatLng(listing.lat, listing.lng)

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content,
        yAnchor: 1.3,
      })

      const marker = new kakao.maps.Marker({ position })
      markers.push(marker)
      overlaysRef.current.push(overlay)

      ;(overlay as { setMap: (m: unknown) => void }).setMap(map)
    }

    // 클러스터러에 마커 추가
    if (clustererRef.current && markers.length > 0) {
      clustererRef.current.addMarkers(markers)
    }
  }, [isLoaded, listings, selectedAtclNo, onMarkerClick, clearOverlays])

  // 선택된 매물로 지도 이동
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !selectedAtclNo) return

    const selected = listings.find(l => l.atclNo === selectedAtclNo)
    if (selected?.lat && selected?.lng) {
      const kakao = window.kakao
      const position = new kakao.maps.LatLng(selected.lat, selected.lng)
      mapRef.current.setCenter(position)
      mapRef.current.setLevel(3)
    }
  }, [isLoaded, selectedAtclNo, listings])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">지도 로딩 중...</div>
      </div>
    )
  }

  return <div ref={mapContainerRef} className="w-full h-full" />
}
