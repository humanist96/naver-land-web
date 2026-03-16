'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LandingPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      if (user.status === 'approved') {
        router.replace('/search')
      } else if (user.status === 'pending') {
        router.replace('/pending')
      }
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center space-y-8">
          <h1 className="text-5xl font-bold text-gray-900">
            NaverLand <span className="text-blue-600">Dashboard</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            네이버 부동산 매물을 실시간으로 검색하고,
            시장 동향을 한눈에 파악하세요.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="text-3xl mb-3">&#128269;</div>
              <h3 className="font-semibold text-lg">매물 검색</h3>
              <p className="text-sm text-gray-500 mt-2">
                자연어로 검색하고 다양한 필터로 원하는 매물을 찾으세요
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="text-3xl mb-3">&#128200;</div>
              <h3 className="font-semibold text-lg">시장 분석</h3>
              <p className="text-sm text-gray-500 mt-2">
                가격 추이, 매물 변동, 지역별 동향을 차트로 확인하세요
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="text-3xl mb-3">&#128276;</div>
              <h3 className="font-semibold text-lg">변동 알림</h3>
              <p className="text-sm text-gray-500 mt-2">
                관심 지역의 가격 변동과 신규 매물을 자동으로 추적합니다
              </p>
            </div>
          </div>

          <div className="flex justify-center space-x-4 mt-8">
            <Link
              href="/login"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="px-8 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              회원가입
            </Link>
          </div>

          <p className="text-sm text-gray-400">
            책 구매자 전용 서비스 - 관리자 승인 후 이용 가능
          </p>
        </div>
      </div>
    </div>
  )
}
