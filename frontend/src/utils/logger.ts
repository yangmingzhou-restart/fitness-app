/**
 * 统一日志格式：[时间] [级别] [模块] [追踪ID] 信息
 */

const SESSION_ID = Math.random().toString(36).slice(2, 10);

function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function format(level: string, module: string, msg: string, traceId?: string): string {
  const rid = traceId || SESSION_ID;
  return `${ts()} | ${level.padEnd(5)} | ${module} | ${rid} | ${msg}`;
}

export const logger = {
  info(module: string, msg: string, traceId?: string) {
    console.log(format('INFO', module, msg, traceId));
  },
  warn(module: string, msg: string, traceId?: string) {
    console.warn(format('WARN', module, msg, traceId));
  },
  error(module: string, msg: string, traceId?: string) {
    console.error(format('ERROR', module, msg, traceId));
  },
  debug(module: string, msg: string, traceId?: string) {
    console.log(format('DEBUG', module, msg, traceId));
  },
};

/** 生成唯一追踪 ID（用于单次操作追踪，如一次 AI 分析） */
export function newTraceId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
