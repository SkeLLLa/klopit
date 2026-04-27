export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const STORAGE_KEY = 'klopit:logLevel';
const DEFAULT_LEVEL: LogLevel = 'error';

const RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function isLogLevel(value: string | null): value is LogLevel {
  return value !== null && (LOG_LEVELS as readonly string[]).includes(value);
}

function createLoggerState() {
  let level: LogLevel = $state(DEFAULT_LEVEL);

  function init() {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLogLevel(stored)) {
      level = stored;
    }
  }

  function setLevel(next: LogLevel) {
    level = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  function enabled(target: Exclude<LogLevel, 'silent'>): boolean {
    return RANK[level] >= RANK[target];
  }

  return {
    get level() {
      return level;
    },
    init,
    setLevel,
    enabled,
  };
}

export const loggerState = createLoggerState();

function format(scope: string, args: unknown[]): unknown[] {
  return [`[${scope}]`, ...args];
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...args) => {
      if (loggerState.enabled('debug')) console.debug(...format(scope, args));
    },
    info: (...args) => {
      if (loggerState.enabled('info')) console.info(...format(scope, args));
    },
    warn: (...args) => {
      if (loggerState.enabled('warn')) console.warn(...format(scope, args));
    },
    error: (...args) => {
      if (loggerState.enabled('error')) console.error(...format(scope, args));
    },
  };
}
