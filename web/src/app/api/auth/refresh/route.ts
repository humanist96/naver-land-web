import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, signAccessToken } from '@/lib/auth-middleware'
import { supabaseAdmin } from '@/lib/supabase'
import { AUTH } from '@/domain/constants'
import type { ApiResponse } from '@/types/api'
import type { UserRole, UserStatus } from '@/types/user'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(AUTH.COOKIE_NAME_REFRESH)?.value

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_REFRESH_TOKEN', message: '리프레시 토큰이 없습니다.' } },
        { status: 401 }
      )
    }

    const payload = await verifyToken(refreshToken)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: '토큰이 만료되었습니다. 다시 로그인해주세요.' } },
        { status: 401 }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', payload.userId)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } },
        { status: 404 }
      )
    }

    const newAccessToken = await signAccessToken({
      userId: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
      status: profile.status as UserStatus,
    })

    const response: ApiResponse<{ accessToken: string }> = {
      success: true,
      data: { accessToken: newAccessToken },
    }

    const res = NextResponse.json(response)
    res.cookies.set(AUTH.COOKIE_NAME_ACCESS, newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH.ACCESS_TOKEN_MAX_AGE,
      path: '/',
    })

    return res
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    )
  }
}
