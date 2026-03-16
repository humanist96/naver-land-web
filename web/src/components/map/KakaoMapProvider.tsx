'use client'

import Script from 'next/script'
import { createContext, useContext, useState } from 'react'

interface KakaoMapContextType {
  isLoaded: boolean
  error: string | null
}

const KakaoMapContext = createContext<KakaoMapContextType>({ isLoaded: false, error: null })

export function useKakaoMap() {
  return useContext(KakaoMapContext)
}

export function KakaoMapProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || ''

  if (!appKey) {
    return (
      <KakaoMapContext.Provider value={{ isLoaded: false, error: 'KAKAO_MAP_KEY 미설정' }}>
        {children}
      </KakaoMapContext.Provider>
    )
  }

  return (
    <KakaoMapContext.Provider value={{ isLoaded, error }}>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&libraries=clusterer&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => {
          if (window.kakao?.maps?.load) {
            window.kakao.maps.load(() => {
              setIsLoaded(true)
            })
          } else {
            setError('Kakao Maps SDK 로드 실패')
          }
        }}
        onError={() => {
          setError('Kakao Maps 스크립트 로드 실패')
        }}
      />
      {children}
    </KakaoMapContext.Provider>
  )
}

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void
        LatLng: new (lat: number, lng: number) => unknown
        Map: new (container: HTMLElement, options: Record<string, unknown>) => unknown
        Marker: new (options: Record<string, unknown>) => unknown
        InfoWindow: new (options: Record<string, unknown>) => unknown
        CustomOverlay: new (options: Record<string, unknown>) => unknown
        MarkerClusterer: new (options: Record<string, unknown>) => unknown
        event: {
          addListener: (target: unknown, type: string, handler: () => void) => void
        }
        services: {
          Geocoder: new () => unknown
        }
      }
    }
  }
}
