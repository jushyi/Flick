import { Platform } from 'react-native';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

const CURRENT_LOG_LEVEL: number = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

const SENSITIVE_PATTERNS: RegExp[] = [
  /firebase[_-]?(api[_-]?key|secret|token|credential|private[_-]?key)/gi,
  /(auth|access|refresh|bearer|fcm|push)[_-]?token/gi,
  /password/gi,
  /api[_-]?key/gi,
  /secret[_-]?key/gi,
  /authorization/gi,
  /bearer/gi,
  /credential/gi,
];

const SENSITIVE_FIELDS: string[] = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'fcmToken',
  'pushToken',
  'refreshToken',
  'accessToken',
  'idToken',
  'credential',
  'privateKey',
];

const containsSensitiveData = (str: unknown): boolean => {
  if (typeof str !== 'string') {
    return false;
  }
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str));
};

const sanitizeData = (data: unknown): unknown => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    if (typeof data === 'string' && containsSensitiveData(data)) {
      return '[REDACTED]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeData(value);
    } else if (typeof value === 'string' && containsSensitiveData(value)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

interface FormattedLog {
  timestamp: string;
  level: string;
  platform: string;
  message: string;
  data: unknown;
}

const formatLog = (level: string, message: string, data?: Record<string, unknown>): FormattedLog => {
  const timestamp = new Date().toISOString();
  const platform = Platform.OS;

  return {
    timestamp,
    level,
    platform,
    message,
    data: data ? sanitizeData(data) : undefined,
  };
};

const shouldLog = (level: number): boolean => {
  return level >= CURRENT_LOG_LEVEL;
};

const debug = (message: string, data?: Record<string, unknown>): void => {
  if (!shouldLog(LOG_LEVELS.DEBUG)) {
    return;
  }

  const log = formatLog('DEBUG', message, data);

  if (__DEV__) {
    console.log('[DEBUG]', message, data ? log.data : '');
  }
};

const info = (message: string, data?: Record<string, unknown>): void => {
  if (!shouldLog(LOG_LEVELS.INFO)) {
    return;
  }

  const log = formatLog('INFO', message, data);

  if (__DEV__) {
    console.log('[INFO]', message, data ? log.data : '');
  }
};

const warn = (message: string, data?: Record<string, unknown>): void => {
  if (!shouldLog(LOG_LEVELS.WARN)) {
    return;
  }

  const log = formatLog('WARN', message, data);

  console.warn('[WARN]', message, data ? log.data : '');
};

const error = (message: string, errorObj?: Record<string, unknown>): void => {
  if (!shouldLog(LOG_LEVELS.ERROR)) {
    return;
  }

  const log = formatLog('ERROR', message, errorObj);

  console.error('[ERROR]', message, errorObj ? log.data : '');
};

interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  levels: Record<LogLevel, number>;
  currentLevel: number;
}

const logger: Logger = {
  debug,
  info,
  warn,
  error,
  levels: LOG_LEVELS,
  currentLevel: CURRENT_LOG_LEVEL,
};

export default logger;
