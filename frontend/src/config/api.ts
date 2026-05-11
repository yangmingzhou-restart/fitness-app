import { Platform } from 'react-native'
import Constants from 'expo-constants'

// 自动获取电脑局域网 IP（从 Metro 打包器连接中提取，仅在 Expo Go 开发模式有效）
// 如果是生产构建，fallback 到下面的默认值
//
// ⚠️ 手机热点模式限制：
// 如果手机开热点给电脑连接，手机自身无法访问热点子网内的设备（Android/iOS 限制）。
// 此场景下 LAN_IP 无效，必须使用 ngrok 隧道：
//   1. 电脑端运行: ngrok http 8000
//   2. 复制 https://xxxx.ngrok-free.app 地址
//   3. 设置: set EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app && npx expo start
//   4. 手机使用移动数据（非 WiFi）连接
function getLanIP(): string {
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const ip = hostUri.split(':')[0]
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip
    }
  }
  // Fallback — 仅在 Expo Go 无法自动获取时使用
  return '10.70.149.38'
}

const LAN_IP = getLanIP()
const PORT = '8000'

const DEV_API_URL = Platform.select({
  android: `http://${LAN_IP}:${PORT}`,
  ios: `http://${LAN_IP}:${PORT}`,
  default: `http://${LAN_IP}:${PORT}`,
})

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL

export const ENDPOINTS = {
  ANALYZE: `${API_BASE_URL}/analyze`,
  HISTORY: `${API_BASE_URL}/history`,
  HEALTH: `${API_BASE_URL}/health`,
  EXERCISES: `${API_BASE_URL}/exercises`,
  EXERCISE_RECORDS: `${API_BASE_URL}/exercise-records`,
  PLANS: `${API_BASE_URL}/plans`,
  ANALYTICS: `${API_BASE_URL}/analytics/summary`,
}

export function getVideoUrl(exerciseId: string, angle: string): string {
  return `${API_BASE_URL}/videos/${encodeURIComponent(exerciseId)}/${encodeURIComponent(angle)}.mp4`;
}

export function getCoverUrl(exerciseId: string): string {
  return `${API_BASE_URL}/videos/${encodeURIComponent(exerciseId)}/${encodeURIComponent('封面')}.png`;
}
