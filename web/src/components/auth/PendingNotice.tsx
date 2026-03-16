'use client'

import { useAuth } from '@/hooks/useAuth'

export function PendingNotice() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="text-6xl">&#9202;</div>
        <h1 className="text-2xl font-bold text-gray-900">승인 대기 중</h1>
        <p className="text-gray-600">
          <span className="font-medium">{user?.name}</span>님의 계정이 관리자 승인을 기다리고 있습니다.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            관리자가 승인하면 이메일로 알림을 보내드립니다.
            승인 후 서비스의 모든 기능을 이용하실 수 있습니다.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          <p>가입 이메일: {user?.email}</p>
          <p>가입일: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
