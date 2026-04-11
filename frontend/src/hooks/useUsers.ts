import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as usersApi from '../services/users'
import type { UserCreate, UserUpdate } from '../services/users'

/**
 * 获取用户列表
 */
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getUsers,
  })
}

/**
 * 获取用户详情
 */
export const useUser = (userId: number) => {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: !!userId,
  })
}

/**
 * 创建用户
 */
export const useCreateUser = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: UserCreate) => usersApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/**
 * 更新用户
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: UserUpdate }) =>
      usersApi.updateUser(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/**
 * 删除用户
 */
export const useDeleteUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: number) => usersApi.deleteUser(userId),
    onSuccess: (_data, userId) => {
      // 乐观更新：立即从缓存中移除该用户，避免等待 refetch
      queryClient.setQueryData(['users'], (oldData: any[] = []) => {
        return oldData.filter((user) => user.id !== userId)
      })
    },
    onError: () => {
      // 如果删除失败，撤销乐观更新
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
