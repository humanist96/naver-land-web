import { NextRequest, NextResponse } from 'next/server'
import { requireApproved } from '@/lib/auth-middleware'
import { searchNlq } from '@/lib/cli-bridge'
import { nlqSchema } from '@/lib/validators'
import type { ApiResponse } from '@/types/api'

export async function POST(request: NextRequest) {
  const authResult = await requireApproved(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const parsed = nlqSchema.safeParse(body)

    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || '검색어를 확인해주세요.',
        },
      }
      return NextResponse.json(response, { status: 400 })
    }

    const result = await searchNlq(parsed.data.query)

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    }
    return NextResponse.json(response)
  } catch (error) {
    const err = error as Error
    const response: ApiResponse = {
      success: false,
      error: { code: 'SEARCH_ERROR', message: err.message },
    }
    return NextResponse.json(response, { status: 500 })
  }
}
