import { ENDPOINTS } from '../config/api';
import { logger } from '../utils/logger';

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
}

export interface FoodItem {
  name: string;
  nameEn: string;
  category: string;
  categoryEn: string;
  caloriesPerKg: number;
  estimatedWeightG: number;
  estimatedCalories: number;
  confidence: number;
  reasoning: string;
  macros?: Macros;
}

export interface AnalysisResult {
  foods: FoodItem[];
  totalEstimatedCalories: number;
  totalMacros?: Macros;
  imageCount: number;
  note: string;
}

export interface TimingInfo {
  decodeMs: number;
  aiTotalMs: number;
  totalMs: number;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
  timing?: TimingInfo;
}

export interface HistoryRecord {
  id: number;
  image_thumbnail: string;
  foods: string;
  total_calories: number;
  macros: string;
  created_at: string;
}

export interface HistoryResponse {
  success: boolean;
  records: HistoryRecord[];
  total: number;
}

export interface ExerciseInfo {
  id: string;
  name: string;
  nameEn: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  difficulty: string;
  description: string;
  tips: string[];
  videos: { angle: string; url: string }[];
  coverImage: string;
}

export interface ExerciseRecordResponse {
  id: string;
  exercise_name: string;
  date: string;
  sets: any[];
  muscle_group: string;
  notes: string;
}

export interface AnalyticsSummary {
  dailyFrequency: { date: string; count: number }[];
  muscleGroupDistribution: { group: string; count: number }[];
  totalWorkouts: number;
  mostTrainedGroup: string;
}

export type ApiErrorType = 'dns' | 'connection_refused' | 'network' | 'timeout' | 'server' | 'client';

export class ApiError extends Error {
  type: ApiErrorType;
  status?: number;

  constructor(type: ApiErrorType, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.status = status;
  }

  getUserMessage(): string {
    switch (this.type) {
      case 'dns': return '无法解析服务器地址，请确认后端服务地址正确且网络已连接';
      case 'connection_refused': return '无法连接服务器，请确认后端程序已启动并在运行';
      case 'network': return '网络连接失败，请检查WiFi和数据网络设置';
      case 'timeout': return '请求超时，服务器响应过慢，请稍后重试';
      case 'server': return '服务器繁忙，请稍后重试';
      case 'client': return `请求错误 (${this.status || ''})，请检查输入内容`;
      default: return '未知网络错误，请检查网络连接';
    }
  }
}

function classifyNetworkError(message: string): ApiErrorType {
  const msg = message.toLowerCase();
  if (msg.includes('dns') || msg.includes('resolve') || msg.includes('name') || msg.includes('host')) {
    return 'dns';
  }
  if (msg.includes('refused') || msg.includes('econnrefused') || msg.includes('connection refused')) {
    return 'connection_refused';
  }
  return 'network';
}

function getAuthHeaders(): Record<string, string> {
  const credentials = btoa('test:ymzandcmftest');
  return {
    Authorization: `Basic ${credentials}`,
    'ngrok-skip-browser-warning': 'true',
  };
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 45000,
  retries: number = 2
): Promise<T> {
  let lastError: ApiError | null = null;
  const maxAttempts = retries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...(options.headers as Record<string, string> || {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errorType: ApiErrorType = response.status >= 500 ? 'server' : 'client';
        const text = await response.text().catch(() => '');
        const message = `HTTP ${response.status}: ${text || response.statusText}`;
        logger.error('api', `HTTP ${response.status} on ${url.split('/').pop()}: ${text || response.statusText}`);
        const err = new ApiError(errorType, message, response.status);
        if (errorType === 'server') {
          lastError = err;
          if (attempt < maxAttempts - 1) {
            const delay = (attempt + 1) * 3000;
            logger.warn('api', `服务器错误 第${attempt + 1}/${retries}次重试 ${delay}ms后: ${url.split('/').pop()}`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }
        throw err;
      }

      return response.json();
    } catch (e: any) {
      clearTimeout(timer);

      if (e instanceof ApiError) {
        if (e.type === 'client') throw e;
        lastError = e;
      } else if (e.name === 'AbortError') {
        lastError = new ApiError('timeout', `Request timeout after ${timeoutMs}ms`);
        logger.error('api', `请求超时 (${timeoutMs}ms): ${url.split('/').pop()}`);
      } else {
        const errorType = classifyNetworkError(e.message || '');
        lastError = new ApiError(errorType, e.message || 'Network request failed');
        logger.error('api', `网络错误 [${errorType}]: ${e.message}`);
      }

      if (attempt < maxAttempts - 1 && lastError) {
        // Only retry transient errors
        if (lastError.type === 'dns' || lastError.type === 'connection_refused') {
          break; // Don't retry persistent config errors
        }
        const delay = lastError.type === 'timeout' ? 2000 : (attempt + 1) * 2000;
        logger.info('api', `重试 ${attempt + 1}/${retries} ${delay}ms后: ${url.split('/').pop()}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new ApiError('network', 'Unknown error');
}

export async function analyzeImages(
  images: string[],
  language: string = 'zh',
  clientCompressed: boolean = false
): Promise<AnalyzeResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (clientCompressed) {
    headers['X-Client-Compressed'] = 'true';
  }
  return apiFetch<AnalyzeResponse>(
    ENDPOINTS.ANALYZE,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ images, language }),
    },
    120000,
    1
  );
}

export async function getHistory(
  limit: number = 20,
  offset: number = 0
): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>(
    `${ENDPOINTS.HISTORY}?limit=${limit}&offset=${offset}`
  );
}

export async function getExercises(params?: {
  muscle_group?: string;
  search?: string;
}): Promise<{ exercises: ExerciseInfo[] }> {
  let url = ENDPOINTS.EXERCISES;
  if (params) {
    const sp = new URLSearchParams();
    if (params.muscle_group) sp.set('muscle_group', params.muscle_group);
    if (params.search) sp.set('search', params.search);
    const qs = sp.toString();
    if (qs) url += '?' + qs;
  }
  return apiFetch<{ exercises: ExerciseInfo[] }>(url);
}

export async function getExerciseDetail(
  id: string
): Promise<ExerciseInfo> {
  return apiFetch<ExerciseInfo>(`${ENDPOINTS.EXERCISES}/${encodeURIComponent(id)}`);
}

export async function saveExerciseRecord(record: {
  id: string;
  exercise_name: string;
  date: string;
  sets: any[];
  muscle_group: string;
  notes: string;
}): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(ENDPOINTS.EXERCISE_RECORDS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
}

export async function getExerciseRecords(params?: {
  date?: string;
  start?: string;
  end?: string;
}): Promise<{ records: ExerciseRecordResponse[] }> {
  let url = ENDPOINTS.EXERCISE_RECORDS;
  if (params) {
    const sp = new URLSearchParams();
    if (params.date) sp.set('date', params.date);
    if (params.start) sp.set('start', params.start);
    if (params.end) sp.set('end', params.end);
    const qs = sp.toString();
    if (qs) url += '?' + qs;
  }
  return apiFetch<{ records: ExerciseRecordResponse[] }>(url);
}

export async function getAnalyticsSummary(
  start: string,
  end: string
): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>(
    `${ENDPOINTS.ANALYTICS}?start=${start}&end=${end}`
  );
}

export interface HealthCheckResult {
  ok: boolean;
  error?: string;
  errorType?: ApiErrorType;
  latencyMs?: number;
}

export async function checkHealth(): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(ENDPOINTS.HEALTH, { signal: controller.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    if (response.ok) {
      logger.info('api', `健康检查成功 (${latencyMs}ms)`);
      return { ok: true, latencyMs };
    }
    return { ok: false, error: `Server returned ${response.status}`, errorType: 'server', latencyMs };
  } catch (e: any) {
    const errorType = e.name === 'AbortError'
      ? 'timeout'
      : classifyNetworkError(e.message || '');
    logger.warn('api', `健康检查失败 [${errorType}]: ${e.message}`);
    return { ok: false, error: e.message, errorType, latencyMs: Date.now() - t0 };
  }
}
