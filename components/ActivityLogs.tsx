'use client';

import { useState, useEffect } from 'react';
import { activityLogger, type ActivityLog } from '@/lib/utils/activity-logger';

export function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    // Subscribe to activity logs
    const unsubscribe = activityLogger.subscribe((newLogs) => {
      setLogs(newLogs);
    });

    return unsubscribe;
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-green-400 border-green-400';
      case 'error':
        return 'text-red-400 border-red-400';
      case 'warning':
        return 'text-yellow-400 border-yellow-400';
      default:
        return 'text-cyan-400 border-cyan-400';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return '●';
      case 'error':
        return '●';
      case 'warning':
        return '!';
      default:
        return 'i';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const downloadLogs = () => {
    const logsJson = activityLogger.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-nest-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-black border-t-2 border-cyan-400 px-6 py-3 flex items-center justify-between hover:bg-gray-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 text-xl">{isExpanded ? '▼' : '▲'}</span>
          <span className="font-bold text-cyan-400">ACTIVITY LOGS</span>
          <span className="text-gray-400 text-sm">
            ({logs.length} events)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {logs.slice(0, 3).map((log) => (
            <span
              key={log.id}
              className={`w-2 h-2 rounded-full ${
                log.level === 'error'
                  ? 'bg-red-400'
                  : log.level === 'warning'
                  ? 'bg-yellow-400'
                  : log.level === 'success'
                  ? 'bg-green-400'
                  : 'bg-cyan-400'
              }`}
            ></span>
          ))}
        </div>
      </button>

      {/* Logs Panel */}
      {isExpanded && (
        <div className="bg-black border-t-2 border-cyan-400 max-h-96 overflow-hidden flex flex-col">
          {/* Controls */}
          <div className="p-4 border-b-2 border-gray-800 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded ${
                  filter === 'all'
                    ? 'bg-cyan-400 text-black font-bold'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilter('info')}
                className={`px-3 py-1 text-sm rounded ${
                  filter === 'info'
                    ? 'bg-cyan-400 text-black font-bold'
                    : 'bg-gray-800 text-cyan-400 hover:bg-gray-700'
                }`}
              >
                INFO
              </button>
              <button
                onClick={() => setFilter('success')}
                className={`px-3 py-1 text-sm rounded ${
                  filter === 'success'
                    ? 'bg-green-400 text-black font-bold'
                    : 'bg-gray-800 text-green-400 hover:bg-gray-700'
                }`}
              >
                SUCCESS
              </button>
              <button
                onClick={() => setFilter('warning')}
                className={`px-3 py-1 text-sm rounded ${
                  filter === 'warning'
                    ? 'bg-yellow-400 text-black font-bold'
                    : 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                }`}
              >
                WARNING
              </button>
              <button
                onClick={() => setFilter('error')}
                className={`px-3 py-1 text-sm rounded ${
                  filter === 'error'
                    ? 'bg-red-400 text-black font-bold'
                    : 'bg-gray-800 text-red-400 hover:bg-gray-700'
                }`}
              >
                ERRORS
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadLogs}
                className="px-3 py-1 text-sm bg-gray-800 text-cyan-400 rounded hover:bg-gray-700"
              >
                ↓ EXPORT
              </button>
              <button
                onClick={() => activityLogger.clear()}
                className="px-3 py-1 text-sm bg-gray-800 text-red-400 rounded hover:bg-gray-700"
              >
                CLEAR
              </button>
            </div>
          </div>

          {/* Logs List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No logs to display
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded border-l-4 ${getLevelColor(
                    log.level
                  )} bg-gray-900/50 hover:bg-gray-900 transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-xl ${getLevelColor(log.level)}`}>
                      {getLevelIcon(log.level)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs text-gray-500 mono">
                          {formatTime(log.timestamp)}
                        </span>
                        <span className="text-xs font-bold text-gray-400 uppercase">
                          {log.category}
                        </span>
                      </div>
                      <div className="text-sm text-white">{log.message}</div>
                      {log.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-cyan-400">
                            View details
                          </summary>
                          <pre className="mt-2 p-2 bg-black rounded text-xs text-gray-300 overflow-x-auto">
                            {typeof log.details === 'string'
                              ? log.details
                              : JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
