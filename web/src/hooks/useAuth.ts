'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { User, LoginRequest, SignupRequest } from '@/types/user'
import type { ApiResponse } from '@/types/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (data: LoginRequest) => Promise<{ success: boolean; error?: string }>
  signup: (data: SignupRequest) => Promise<{ success: boolean; error?: string; message?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data: ApiResponse<User> = await res.json()
        if (data.success && data.data) {
          setUser(data.data)
          return
        }
      }
      setUser(null)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false))
  }, [refreshUser])

  const login = useCallback(async (data: LoginRequest) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result: ApiResponse<{ user: User }> = await res.json()

      if (result.success && result.data) {
        setUser(result.data.user)
        return { success: true }
      }

      return { success: false, error: result.error?.message || '로그인에 실패했습니다.' }
    } catch {
      return { success: false, error: '네트워크 오류가 발생했습니다.' }
    }
  }, [])

  const signup = useCallback(async (data: SignupRequest) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result: ApiResponse<User> = await res.json()

      if (result.success) {
        return { success: true, message: result.message }
      }

      return { success: false, error: result.error?.message || '가입에 실패했습니다.' }
    } catch {
      return { success: false, error: '네트워크 오류가 발생했습니다.' }
    }
  }, [])

  const logout = useCallback(() => {
    document.cookie = 'access_token=; path=/; max-age=0'
    document.cookie = 'refresh_token=; path=/; max-age=0'
    setUser(null)
  }, [])

  return { user, isLoading, login, signup, logout, refreshUser }
}
