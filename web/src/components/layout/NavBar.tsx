'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'

export function NavBar() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user || user.status !== 'approved') return null

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/search" className="text-xl font-bold text-blue-600">
              NaverLand
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link
                href="/search"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                매물 검색
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                대시보드
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin/users"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  관리자
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
              >
                <span className="hidden sm:inline">{user.name}</span>
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                  {user.name.charAt(0)}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <div className="px-4 py-2 text-xs text-gray-500 border-b">
                    {user.email}
                  </div>
                  <div className="md:hidden">
                    <Link
                      href="/search"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      매물 검색
                    </Link>
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      대시보드
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        href="/admin/users"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        관리자
                      </Link>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      logout()
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
