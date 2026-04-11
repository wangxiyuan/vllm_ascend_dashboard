import api from './api'

// ============ Types ============

export interface GitHubLabelItem {
  name: string
  color: string
  description?: string
}

export interface GitHubActivityItem {
  number: number
  title: string
  state: string
  user: string
  created_at: string
  html_url: string
  labels?: GitHubLabelItem[]
}

export interface GitHubCommitItem {
  sha: string
  message: string
  author: string
  committed_at: string
  html_url: string
}

export interface GitHubReleaseItem {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  prerelease: boolean
}

export interface GitHubProjectActivity {
  owner: string
  repo: string
  days: number
  pull_requests_count: number
  issues_count: number
  commits_count: number
  releases: {
    latest: GitHubReleaseItem | null
    prerelease: GitHubReleaseItem | null
  }
  pull_requests: GitHubActivityItem[]
  issues: GitHubActivityItem[]
  commits: GitHubCommitItem[]
  error?: string
}

export interface GitHubCombinedActivity {
  ascend: GitHubProjectActivity
  vllm: GitHubProjectActivity
}

// ============ API Functions ============

/**
 * 获取单个项目的 GitHub 动态
 */
export const getGitHubActivity = async (
  days: number = 1,
  project: 'ascend' | 'vllm' = 'ascend'
): Promise<GitHubProjectActivity> => {
  const response = await api.get<GitHubProjectActivity>('/github-activity/activity', {
    params: { days, project },
  })
  return response.data
}

/**
 * 获取 vLLM Ascend 和 vLLM 项目的合并动态
 */
export const getCombinedGitHubActivity = async (
  days: number = 1
): Promise<GitHubCombinedActivity> => {
  const response = await api.get<GitHubCombinedActivity>('/github-activity/activity/combined', {
    params: { days },
  })
  return response.data
}

/**
 * 手动刷新 GitHub 动态数据（强制从 GitHub API 获取）
 */
export const refreshGitHubActivity = async (
  days: number = 1,
  project?: 'ascend' | 'vllm'  // undefined 表示两者都刷新
): Promise<{ success: boolean; message: string; refreshed_projects: string[] }> => {
  const response = await api.post('/github-activity/activity/refresh', null, {
    params: { days, project },
  })
  return response.data
}
