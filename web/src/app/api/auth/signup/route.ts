import { NextRequest, NextResponse } from 'next/server'
import { signupSchema } from '@/lib/validators'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'
import type { User } from '@/types/user'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값을 확인해주세요.' } },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data

    // Supabase Auth signUp (트리거 문제 우회 - anon client 사용)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_EMAIL', message: '이미 등록된 이메일입니다.' } },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_ERROR', message: authError.message } },
        { status: 400 }
      )
    }

    const userId = authData.user?.id
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_ERROR', message: '사용자 생성에 실패했습니다.' } },
        { status: 500 }
      )
    }

    // profiles 테이블에 직접 upsert (트리거가 실패했을 경우 대비)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        name,
        status: 'pending',
        role: 'user',
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError.message)
    }

    const user: User = {
      id: userId,
      email,
      name,
      status: 'pending',
      role: 'user',
      approvedAt: null,
      approvedBy: null,
      createdAt: authData.user?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(
      { success: true, data: user, message: '가입이 완료되었습니다. 관리자 승인 후 서비스를 이용할 수 있습니다.' } as ApiResponse<User>,
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    )
  }
}
