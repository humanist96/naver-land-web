import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { AUTH } from '@/domain/constants'
import type { User, UserRole, UserStatus } from '@/types/user'
import type { ApiResponse } from '@/types/api'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.')
  }
  return new TextEncoder().encode(secret)
}

const JWT_SECRET = new Proxy({} as Uint8Array, {
  get(_target, prop, receiver) {
    return Reflect.get(getJwtSecret(), prop, receiver)
  },
}) as Uint8Array

export interface JwtPayload {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH.ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function signRefreshToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(AUTH.REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export async function getAuthFromRequest(
  request: NextRequest
): Promise<JwtPayload | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return verifyToken(authHeader.slice(7))
  }

  const cookieStore = await cookies()
  const accessToken = cookieStore.get(AUTH.COOKIE_NAME_ACCESS)?.value
  if (accessToken) {
    return verifyToken(accessToken)
  }

  return null
}

function errorResponse(code: string, message: string, status: number): NextResponse {
  const body: ApiResponse = {
    success: false,
    error: { code, message },
  }
  return NextResponse.json(body, { status })
}

export async function requireAuth(
  request: NextRequest
): Promise<JwtPayload | NextResponse> {
  const payload = await getAuthFromRequest(request)
  if (!payload) {
    return errorResponse('UNAUTHORIZED', '인증이 필요합니다.', 401)
  }
  return payload
}

export async function requireApproved(
  request: NextRequest
): Promise<JwtPayload | NextResponse> {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  if (result.status !== 'approved') {
    return errorResponse(
      'APPROVAL_REQUIRED',
      '관리자 승인 후 이용 가능합니다.',
      403
    )
  }
  return result
}

export async function requireAdmin(
  request: NextRequest
): Promise<JwtPayload | NextResponse> {
  const result = await requireApproved(request)
  if (result instanceof NextResponse) return result

  if (result.role !== 'admin') {
    return errorResponse('ADMIN_REQUIRED', '관리자 권한이 필요합니다.', 403)
  }
  return result
}
