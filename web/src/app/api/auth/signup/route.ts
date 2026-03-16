import { NextRequest, NextResponse } from 'next/server'
import { signupSchema } from '@/lib/validators'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types/api'
import type { User } from '@/types/user'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || '입력값을 확인해주세요.',
        },
      }
      return NextResponse.json(response, { status: 400 })
    }

    const { email, password, name } = parsed.data

    // Supabase Auth로 사용자 생성 (bcrypt 해싱 내장)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
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

    // profiles 테이블에 name 업데이트 (트리거가 기본값만 넣으므로)
    if (authData.user) {
      await supabaseAdmin.from('profiles').update({ name }).eq('id', authData.user.id)
    }

    const user: User = {
      id: authData.user?.id || '',
      email,
      name,
      status: 'pending',
      role: 'user',
      approvedAt: null,
      approvedBy: null,
      createdAt: authData.user?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const response: ApiResponse<User> = {
      success: true,
      data: user,
      message: '가입이 완료되었습니다. 관리자 승인 후 서비스를 이용할 수 있습니다.',
    }
    return NextResponse.json(response, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    )
  }
}
