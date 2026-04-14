import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as jobOwnersApi from '../services/jobOwners'

/**
 * 获取 Job 责任人列表
 */
export const useJobOwners = (params?: {
  workflow_name?: string
}) => {
  return useQuery({
    queryKey: ['job-owners', params],
    queryFn: () => jobOwnersApi.getJobOwners(params),
  })
}

/**
 * 获取所有可用的 job 列表
 */
export const useAvailableJobs = (params?: {
  workflow_name?: string
}) => {
  return useQuery({
    queryKey: ['available-jobs', params],
    queryFn: () => jobOwnersApi.getAvailableJobs(params),
  })
}

/**
 * 获取单个 Job 责任人
 */
export const useJobOwner = (ownerId: number | null) => {
  return useQuery({
    queryKey: ['job-owner', ownerId],
    queryFn: () => ownerId ? jobOwnersApi.getJobOwner(ownerId) : Promise.resolve(null),
    enabled: !!ownerId,
  })
}

/**
 * 创建 Job 责任人
 */
export const useCreateJobOwner = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: jobOwnersApi.createJobOwner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-owners'] })
    },
  })
}

/**
 * 更新 Job 责任人
 */
export const useUpdateJobOwner = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ownerId, data }: { ownerId: number; data: any }) =>
      jobOwnersApi.updateJobOwner(ownerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-owners'] })
    },
  })
}

/**
 * 删除 Job 责任人
 */
export const useDeleteJobOwner = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: jobOwnersApi.deleteJobOwner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-owners'] })
    },
  })
}

/**
 * 切换 Job 隐藏/显示状态
 */
export const useToggleJobHidden = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: jobOwnersApi.toggleJobHidden,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-owners'] })
      queryClient.invalidateQueries({ queryKey: ['hidden-jobs-list'] })
    },
  })
}

/**
 * 获取 Job 汇总统计数据
 */
export const useJobStats = (params?: {
  days?: number | 'all'
  workflow_name?: string
  job_name?: string
}) => {
  return useQuery({
    queryKey: ['job-stats', params],
    queryFn: () => jobOwnersApi.getJobStats(params),
  })
}

/**
 * 获取所有隐藏的 Job 列表
 */
export const useHiddenJobsList = () => {
  return useQuery({
    queryKey: ['hidden-jobs-list'],
    queryFn: jobOwnersApi.getHiddenJobs,
  })
}
