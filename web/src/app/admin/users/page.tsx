'use client'

import { useState, useEffect, useCallback } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { NavBar } from '@/components/layout/NavBar'
import type { User } from '@/types/user'
import type { ApiResponse } from '@/types/api'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data: ApiResponse<User[]> = await res.json()
      if (data.success && data.data) {
        setUsers(data.data)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function handleAction(userId: string, action: 'approve' | 'reject' | 'suspend') {
    setActionLoading(userId)
    try {
      await fetch(`/api/admin/users/${userId}/${action}`, { method: 'PATCH' })
      await fetchUsers()
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      suspended: 'bg-gray-100 text-gray-800',
    }
    const labels: Record<string, string> = {
      pending: '대기',
      approved: '승인',
      rejected: '거부',
      suspended: '정지',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <AuthGuard requireApproved requireAdmin>
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">사용자 관리</h1>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">{statusBadge(user.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.role}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {user.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(user.id, 'approve')}
                            disabled={actionLoading === user.id}
                            className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleAction(user.id, 'reject')}
                            disabled={actionLoading === user.id}
                            className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            거부
                          </button>
                        </>
                      )}
                      {user.status === 'approved' && user.role !== 'admin' && (
                        <button
                          onClick={() => handleAction(user.id, 'suspend')}
                          disabled={actionLoading === user.id}
                          className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                        >
                          정지
                        </button>
                      )}
                      {user.status === 'suspended' && (
                        <button
                          onClick={() => handleAction(user.id, 'approve')}
                          disabled={actionLoading === user.id}
                          className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                        >
                          복원
                        </button>
                      )}
                      {user.status === 'rejected' && (
                        <button
                          onClick={() => handleAction(user.id, 'approve')}
                          disabled={actionLoading === user.id}
                          className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                        >
                          승인
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
