import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../services/auth'

export const useCurrentUser = () => {
  const isLoggedIn = !!localStorage.getItem('access_token')

  return useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
    enabled: isLoggedIn,
    staleTime: 0, // 总是视为过期，确保切换用户后立即刷新
    retry: 1,
  })
}
