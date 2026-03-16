import { NextResponse } from 'next/server'
import { AUTH } from '@/domain/constants'
import type { ApiResponse } from '@/types/api'

export async function POST() {
  const response: ApiResponse = { success: true, message: '로그아웃 되었습니다.' }
  const res = NextResponse.json(response)

  res.cookies.set(AUTH.COOKIE_NAME_ACCESS, '', { maxAge: 0, path: '/' })
  res.cookies.set(AUTH.COOKIE_NAME_REFRESH, '', { maxAge: 0, path: '/' })

  return res
}
