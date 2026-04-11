import api from './api'

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface UserResponse {
  id: number
  username: string
  email: string | null
  role: string
  is_active: boolean
  created_at: string
}

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<TokenResponse> => {
  const response = await api.post<TokenResponse>('/auth/login', data)
  return response.data
}

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
  const response = await api.get<UserResponse>('/auth/me')
  return response.data
}

/**
 * 用户登出
 */
export const logout = async (): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>('/auth/logout')
  return response.data
}

/**
 * 刷新 Token
 */
export const refreshToken = async (refreshToken: string): Promise<TokenResponse> => {
  const response = await api.post<TokenResponse>('/auth/refresh', null, {
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  })
  return response.data
}

/**
 * 修改密码
 */
export const changePassword = async (data: { old_password: string; new_password: string }): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>('/auth/change-password', data)
  return response.data
}
