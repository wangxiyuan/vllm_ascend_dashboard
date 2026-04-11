import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as systemConfigApi from '../services/systemConfig'
import type { SyncConfigUpdate, AppConfigUpdate, GitHubConfigUpdate } from '../types/systemConfig'

/**
 * 获取系统配置
 */
export const useSystemConfig = () => {
  return useQuery({
    queryKey: ['system-config'],
    queryFn: systemConfigApi.getSystemConfig,
  })
}

/**
 * 获取系统状态
 */
export const useSystemStatus = () => {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: systemConfigApi.getSystemStatus,
    // 每 30 秒轮询一次状态
    refetchInterval: 30000,
  })
}

/**
 * 更新应用配置
 */
export const useUpdateAppConfig = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: AppConfigUpdate) => systemConfigApi.updateAppConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
    },
  })
}

/**
 * 更新 GitHub 配置
 */
export const useUpdateGitHubConfig = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: GitHubConfigUpdate) => systemConfigApi.updateGitHubConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
    },
  })
}

/**
 * 更新同步配置
 */
export const useUpdateSyncConfig = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: SyncConfigUpdate) => systemConfigApi.updateSyncConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
      queryClient.invalidateQueries({ queryKey: ['system-status'] })
    },
  })
}

/**
 * 触发配置重载
 */
export const useTriggerConfigReload = () => {
  return useMutation({
    mutationFn: systemConfigApi.triggerConfigReload,
  })
}
