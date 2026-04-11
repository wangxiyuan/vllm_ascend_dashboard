import { useCurrentUser } from './useCurrentUser'

/**
 * 检查用户是否有管理员权限
 * @returns undefined - 用户信息加载中; false - 无管理员权限; true - 有管理员权限
 */
export const useHasAdminRole = () => {
  const { data: currentUser, isLoading } = useCurrentUser()

  // 用户信息加载中，返回 undefined
  if (isLoading || !currentUser) {
    return undefined
  }

  return currentUser.role === 'admin' || currentUser.role === 'super_admin'
}

/**
 * 检查用户是否是超级管理员
 */
export const useHasSuperAdminRole = () => {
  const { data: currentUser } = useCurrentUser()
  
  if (!currentUser) {
    return false
  }
  
  return currentUser.role === 'super_admin'
}
