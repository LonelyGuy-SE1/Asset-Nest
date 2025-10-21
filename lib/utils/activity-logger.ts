/**
 * Activity Logger
 * Tracks all user actions and system events for transparency
 */

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ActivityLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  details?: any;
}

class ActivityLogger {
  private logs: ActivityLog[] = [];
  private listeners: Set<(logs: ActivityLog[]) => void> = new Set();
  private maxLogs = 1000;

  log(level: LogLevel, category: string, message: string, details?: any) {
    const log: ActivityLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
    };

    this.logs.unshift(log); // Add to beginning
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(this.logs));

    // Also log to console for debugging (disable in production)
    if (process.env.NODE_ENV === 'development') {
      const prefix = {
        info: '[INFO]',
        success: '[OK]',
        warning: '[WARN]',
        error: '[ERROR]',
      }[level];

      console.log(`${prefix} [${category}] ${message}`, details || '');
    }

    return log;
  }

  info(category: string, message: string, details?: any) {
    return this.log('info', category, message, details);
  }

  success(category: string, message: string, details?: any) {
    return this.log('success', category, message, details);
  }

  warning(category: string, message: string, details?: any) {
    return this.log('warning', category, message, details);
  }

  error(category: string, message: string, details?: any) {
    return this.log('error', category, message, details);
  }

  getLogs(): ActivityLog[] {
    return this.logs;
  }

  subscribe(listener: (logs: ActivityLog[]) => void) {
    this.listeners.add(listener);
    // Immediately call with current logs
    listener(this.logs);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear() {
    this.logs = [];
    this.listeners.forEach((listener) => listener(this.logs));
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Export singleton instance
export const activityLogger = new ActivityLogger();
