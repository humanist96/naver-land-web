import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validators'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { signAccessToken, signRefreshToken } from '@/lib/auth-middleware'
import { AUTH } from '@/domain/constants'
import type { ApiResponse } from '@/types/api'
import type { LoginResponse, User, UserRole, UserStatus } from '@/types/user'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값을 확인해주세요.' } },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    // Supabase Auth로 로그인 (bcrypt 검증 내장)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' } },
        { status: 401 }
      )
    }

    // profiles 테이블에서 사용자 정보 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: { code: 'PROFILE_NOT_FOUND', message: '프로필을 찾을 수 없습니다.' } },
        { status: 404 }
      )
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      status: profile.status as UserStatus,
      role: profile.role as UserRole,
      approvedAt: profile.approved_at,
      approvedBy: profile.approved_by,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    }

    const accessToken = await signAccessToken(tokenPayload)
    const refreshToken = await signRefreshToken(tokenPayload)

    const responseData: LoginResponse = {
      user,
      tokens: { accessToken, refreshToken },
    }

    const response: ApiResponse<LoginResponse> = { success: true, data: responseData }
    const res = NextResponse.json(response, { status: 200 })

    res.cookies.set(AUTH.COOKIE_NAME_ACCESS, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH.ACCESS_TOKEN_MAX_AGE,
      path: '/',
    })

    res.cookies.set(AUTH.COOKIE_NAME_REFRESH, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH.REFRESH_TOKEN_MAX_AGE,
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
