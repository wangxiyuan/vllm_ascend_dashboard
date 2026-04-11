import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

// 启用插件
dayjs.extend(utc)
dayjs.extend(relativeTime)

// 设置默认语言为中文
dayjs.locale('zh-cn')

/**
 * 格式化 UTC 时间为北京时间 (UTC+8)
 * @param utcTime UTC 时间字符串（如 "2024-03-24T10:00:00+00:00"）
 * @param format 格式化模板，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的北京时间字符串
 */
export const formatTimezone = (
  utcTime: dayjs.ConfigType,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string => {
  if (!utcTime) return '-'
  // 解析 UTC 时间并转换为北京时间 (UTC+8)
  return dayjs.utc(utcTime).utcOffset(8).format(format)
}

/**
 * 获取相对时间（基于北京时间）
 * @param utcTime UTC 时间字符串（如 "2024-03-24T10:00:00+00:00"）
 * @returns 相对时间字符串
 */
export const fromTimezoneNow = (utcTime: dayjs.ConfigType): string => {
  if (!utcTime) return ''
  // 解析 UTC 时间并转换为北京时间，然后计算相对时间
  return dayjs.utc(utcTime).utcOffset(8).fromNow()
}

/**
 * 获取配置的时区显示名称
 */
export const getTimezoneDisplayName = (timezone: string): string => {
  const timezoneNames: Record<string, string> = {
    'Asia/Shanghai': '北京时间',
    'UTC': 'UTC 时间',
    'America/New_York': '美东时间',
    'America/Los_Angeles': '美西时间',
    'Europe/London': '伦敦时间',
    'Europe/Berlin': '柏林时间',
    'Asia/Tokyo': '东京时间',
  }
  return timezoneNames[timezone] || timezone
}
