import api from './api'

// ============ Types ============

export interface User {
  id: number
  username: string
  email: string | null
  role: string  // 'user' | 'admin' | 'super_admin'
  is_active: boolean
  created_at: string
}

export interface UserCreate {
  username: string
  email?: string
  password: string
  role?: string  // 'user' | 'admin' | 'super_admin'
}

export interface UserUpdate {
  email?: string
  role?: string
  is_active?: boolean
}

// ============ API Functions ============

/**
 * 获取用户列表（仅超级管理员）
 */
export const getUsers = async (): Promise<User[]> => {
  const response = await api.get<User[]>('/users')
  return response.data
}

/**
 * 获取用户详情
 */
export const getUser = async (userId: number): Promise<User> => {
  const response = await api.get<User>(`/users/${userId}`)
  return response.data
}

/**
 * 创建用户（仅超级管理员）
 */
export const createUser = async (data: UserCreate): Promise<User> => {
  const response = await api.post<User>('/users', data)
  return response.data
}

/**
 * 更新用户信息
 */
export const updateUser = async (userId: number, data: UserUpdate): Promise<User> => {
  const response = await api.put<User>(`/users/${userId}`, data)
  return response.data
}

/**
 * 删除用户（仅超级管理员）
 */
export const deleteUser = async (userId: number): Promise<{ message: string }> => {
  const response = await api.delete<{ message: string }>(`/users/${userId}`)
  return response.data
}

/**
 * 重置用户密码（管理员权限）
 */
export const resetUserPassword = async (userId: number, newPassword: string): Promise<{ message: string }> => {
  const response = await api.put<{ message: string }>(`/users/${userId}/password`, {
    new_password: newPassword,
  })
  return response.data
}
