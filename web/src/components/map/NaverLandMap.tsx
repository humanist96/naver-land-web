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
  const { isLoaded, error } = useKakaoMap()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  const overlaysRef = useRef<Array<{ setMap: (m: unknown) => void }>>([])
  const clustererInstanceRef = useRef<{ clear: () => void; addMarkers: (m: unknown[]) => void } | null>(null)

  const clearOverlays = useCallback(() => {
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []
    if (clustererInstanceRef.current) {
      clustererInstanceRef.current.clear()
    }
  }, [])

  // 지도 초기화
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current) return
    if (mapInstanceRef.current) return

    const kakao = window.kakao
    const mapOptions = {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: zoom,
    }
    const map = new kakao.maps.Map(mapContainerRef.current, mapOptions)
    mapInstanceRef.current = map

    clustererInstanceRef.current = new kakao.maps.MarkerClusterer({
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
      ],
    }) as unknown as typeof clustererInstanceRef.current
  }, [isLoaded, center.lat, center.lng, zoom])

  // 매물 마커 표시
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return

    clearOverlays()

    const kakao = window.kakao
    const map = mapInstanceRef.current
    const markers: unknown[] = []

    for (const listing of listings) {
      if (!listing.lat || !listing.lng) continue

      const color = TRADE_COLORS[listing.tradeType] || '#6b7280'
      const isSelected = listing.atclNo === selectedAtclNo
      const priceText = formatPriceShort(listing.price)

      const content = document.createElement('div')
      content.innerHTML = `
        <div style="
          cursor: pointer;
          padding: 3px 7px;
          background: ${isSelected ? '#1e40af' : color};
          color: white;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid ${isSelected ? '#fff' : 'transparent'};
          transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
          transition: all 0.15s;
          z-index: ${isSelected ? 100 : 1};
        ">
          ${priceText}
        </div>
      `

      const capturedListing = listing
      content.addEventListener('click', () => {
        onMarkerClick?.(capturedListing)
      })

      const position = new kakao.maps.LatLng(listing.lat, listing.lng)

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content,
        yAnchor: 1.3,
      }) as unknown as { setMap: (m: unknown) => void }

      const marker = new kakao.maps.Marker({ position })
      markers.push(marker)
      overlaysRef.current.push(overlay)
      overlay.setMap(map)
    }

    if (clustererInstanceRef.current && markers.length > 0) {
      clustererInstanceRef.current.addMarkers(markers)
    }
  }, [isLoaded, listings, selectedAtclNo, onMarkerClick, clearOverlays])

  // 선택된 매물로 지도 이동
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !selectedAtclNo) return

    const selected = listings.find(l => l.atclNo === selectedAtclNo)
    if (selected?.lat && selected?.lng) {
      const kakao = window.kakao
      const position = new kakao.maps.LatLng(selected.lat, selected.lng)
      const map = mapInstanceRef.current as unknown as { setCenter: (p: unknown) => void; setLevel: (l: number) => void }
      map.setCenter(position)
      map.setLevel(3)
    }
  }, [isLoaded, selectedAtclNo, listings])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50">
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
}
