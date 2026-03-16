export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  status: UserStatus
  role: UserRole
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  user: User
  tokens: AuthTokens
}

export interface SignupRequest {
  email: string
  password: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}
