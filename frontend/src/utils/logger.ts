/**
 * 统一日志格式：[时间] [级别] [模块] [追踪ID] 信息
 * 同时输出到控制台和本地文件 (documentDirectory/logs/app.log)
 */
import { Paths, File, Directory } from 'expo-file-system';

const SESSION_ID = Math.random().toString(36).slice(2, 10);
const MAX_LOG_SIZE = 1 * 1024 * 1024; // 1MB

let _logFile: File | null = null;
let _initialized = false;

function getLogFile(): File {
  if (!_logFile) {
    _logFile = new File(Paths.document, 'logs', 'app.log');
  }
  return _logFile;
}

function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function format(level: string, module: string, msg: string, traceId?: string): string {
  const rid = traceId || SESSION_ID;
  return `${ts()} | ${level.padEnd(5)} | ${module} | ${rid} | ${msg}`;
}

function initLogFile() {
  if (_initialized) return;
  _initialized = true;
  try {
    const logDir = new Directory(Paths.document, 'logs');
    if (!logDir.exists) {
      logDir.create({ intermediates: true });
    }
    const file = getLogFile();
    if (file.exists && file.size > MAX_LOG_SIZE) {
      file.delete();
    }
    if (!file.exists) {
      file.create();
    }
  } catch {
    // 初始化失败不影响控制台日志
  }
}

function writeLine(line: string) {
  try {
    const file = getLogFile();
    file.write(line + '\n', { append: true });
  } catch {
    // 写文件失败不影响控制台日志
  }
}

function write(level: string, module: string, msg: string, traceId?: string) {
  const line = format(level, module, msg, traceId);

  switch (level) {
    case 'ERROR': console.error(line); break;
    case 'WARN':  console.warn(line); break;
    default:      console.log(line); break;
  }

  initLogFile();
  writeLine(line);
}

export const logger = {
  info(module: string, msg: string, traceId?: string) {
    write('INFO', module, msg, traceId);
  },
  warn(module: string, msg: string, traceId?: string) {
    write('WARN', module, msg, traceId);
  },
  error(module: string, msg: string, traceId?: string) {
    write('ERROR', module, msg, traceId);
  },
  debug(module: string, msg: string, traceId?: string) {
    write('DEBUG', module, msg, traceId);
  },
};

/** 导出日志文件路径，方便在设置页显示或导出 */
export function getLogFilePath(): string {
  return getLogFile().uri;
}

/** 生成唯一追踪 ID（用于单次操作追踪，如一次 AI 分析） */
export function newTraceId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
