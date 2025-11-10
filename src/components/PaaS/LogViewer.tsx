/**
 * Log Viewer Component
 * Real-time log streaming viewer
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';

interface LogViewerProps {
  appId: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ appId }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/paas/apps/${appId}/logs?limit=1000`);
      setLogs((data.logs || []).map((log: any) => `[${log.timestamp}] ${log.message}`));
    } catch (error) {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = search
    ? logs.filter((log) => log.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Application Logs</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button size="sm" variant="outline" onClick={downloadLogs}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
          {loading ? (
            <p>Loading logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-gray-500">No logs available</p>
          ) : (
            filteredLogs.map((log, i) => <div key={i}>{log}</div>)
          )}
          <div ref={logEndRef} />
        </div>
      </CardContent>
    </Card>
  );
};
