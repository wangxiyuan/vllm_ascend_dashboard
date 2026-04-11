import api from './api'

// ============ Types ============

export interface JobOwner {
  id: number
  workflow_name: string
  job_name: string
  display_name: string | null
  owner: string
  email: string | null
  notes: string | null
  is_hidden: boolean
  created_at: string
  updated_at: string
}

export interface JobVisibility {
  id: number
  workflow_name: string
  job_name: string
  is_hidden: boolean
  created_at: string
  updated_at: string
}

export interface JobOwnerCreate {
  workflow_name: string
  job_name: string
  owner: string
  display_name?: string
  email?: string
  notes?: string
}

export interface JobOwnerUpdate {
  owner?: string
  email?: string
  notes?: string
  display_name?: string
}

export interface JobStats {
  workflow_name: string
  job_name: string
  display_name: string | null
  owner: string | null
  owner_email: string | null
  total_runs: number
  success_runs: number
  failure_runs: number
  success_rate: number
  avg_duration_seconds: number | null
  min_duration_seconds: number | null
  max_duration_seconds: number | null
  last_run_at: string | null
  last_status: string | null
  last_conclusion: string | null
}

// ============ API Functions ============

/**
 * 获取 Job 责任人列表
 */
export const getJobOwners = async (params?: {
  workflow_name?: string
}): Promise<JobOwner[]> => {
  const response = await api.get<JobOwner[]>('/job-owners', { params })
  return response.data
}

/**
 * 获取所有可用的 job 列表
 */
export const getAvailableJobs = async (params?: {
  workflow_name?: string
}): Promise<Array<{ workflow_name: string; job_name: string }>> => {
  const response = await api.get<Array<{ workflow_name: string; job_name: string }>>('/job-owners/available-jobs', { params })
  return response.data
}

/**
 * 获取单个 Job 责任人
 */
export const getJobOwner = async (ownerId: number): Promise<JobOwner> => {
  const response = await api.get<JobOwner>(`/job-owners/${ownerId}`)
  return response.data
}

/**
 * 创建 Job 责任人
 */
export const createJobOwner = async (data: JobOwnerCreate): Promise<JobOwner> => {
  const response = await api.post<JobOwner>('/job-owners', data)
  return response.data
}

/**
 * 更新 Job 责任人
 */
export const updateJobOwner = async (
  ownerId: number,
  data: JobOwnerUpdate
): Promise<JobOwner> => {
  const response = await api.put<JobOwner>(`/job-owners/${ownerId}`, data)
  return response.data
}

/**
 * 删除 Job 责任人
 */
export const deleteJobOwner = async (ownerId: number): Promise<{ message: string }> => {
  const response = await api.delete<{ message: string }>(`/job-owners/${ownerId}`)
  return response.data
}

/**
 * 切换 Job 隐藏/显示状态
 */
export const toggleJobHidden = async (ownerId: number): Promise<{ message: string; is_hidden: boolean }> => {
  const response = await api.post<{ message: string; is_hidden: boolean }>(`/job-owners/${ownerId}/toggle-hidden`)
  return response.data
}

/**
 * 获取 Job 汇总统计数据
 */
export const getJobStats = async (params?: {
  days?: number | 'all'
  workflow_name?: string
  job_name?: string
}): Promise<JobStats[]> => {
  const response = await api.get<JobStats[]>('/job-owners/stats/job-summary', { 
    params: {
      ...params,
      days: params?.days === 'all' ? undefined : params?.days,
    }
  })
  return response.data
}

/**
 * 获取所有 Job 可见性配置
 */
export const getJobVisibilityList = async (): Promise<JobVisibility[]> => {
  const response = await api.get<JobVisibility[]>('/job-owners/visibility')
  return response.data
}

/**
 * 切换 Job 可见性状态
 */
export const toggleJobVisibility = async (params: {
  workflow_name: string
  job_name: string
  is_hidden: boolean
}): Promise<JobVisibility> => {
  const response = await api.post<JobVisibility>('/job-owners/visibility/toggle', null, { params })
  return response.data
}
