import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Download, 
  Search, 
  Filter, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  Bug,
  Calendar,
  Clock,
  Terminal,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ServiceLogEntry } from '@/types/containers';

interface ServiceLogsViewerProps {
  logs: ServiceLogEntry[];
  loading?: boolean;
  onRefresh: () => void;
  onDownload?: () => void;
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface LogEntryProps {
  entry: ServiceLogEntry;
  searchQuery: string;
}

const getLevelIcon = (level: ServiceLogEntry['level']) => {
  switch (level) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />;
    case 'debug':
      return <Bug className="h-4 w-4 text-gray-500" />;
    default:
      return <Terminal className="h-4 w-4 text-gray-400" />;
  }
};

const getLevelColor = (level: ServiceLogEntry['level']) => {
  switch (level) {
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'info':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'debug':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const highlightText = (text: string, searchQuery: string) => {
  if (!searchQuery.trim()) return text;
  
  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
        {part}
      </mark>
    ) : part
  );
};

const LogEntry: React.FC<LogEntryProps> = ({ entry, searchQuery }) => {
  const timestamp = new Date(entry.timestamp);
  const timeString = timestamp.toLocaleTimeString();
  const dateString = timestamp.toLocaleDateString();
  
  return (
    <div className={cn(
      "flex gap-3 p-3 border-l-4 hover:bg-muted/50 transition-colors",
      getLevelColor(entry.level)
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {getLevelIcon(entry.level)}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge 
            variant="outline" 
            className={cn("text-xs uppercase font-mono", getLevelColor(entry.level))}
          >
            {entry.level}
          </Badge>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeString}</span>
            <Calendar className="h-3 w-3 ml-2" />
            <span>{dateString}</span>
          </div>
          
          {entry.source && (
            <Badge variant="secondary" className="text-xs">
              {entry.source}
            </Badge>
          )}
        </div>
        
        <div className="font-mono text-sm break-words">
          {highlightText(entry.message, searchQuery)}
        </div>
      </div>
    </div>
  );
};

export const ServiceLogsViewer: React.FC<ServiceLogsViewerProps> = ({
  logs,
  loading = false,
  onRefresh,
  onDownload,
  className,
  autoRefresh = false,
  refreshInterval = 5000,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        onRefresh();
      }, refreshInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, onRefresh]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);

  // Filter logs based on search query and level
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchQuery.trim() === '' || 
                         log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (log.source && log.source.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    
    return matchesSearch && matchesLevel;
  });

  // Get log level counts for filter badges
  const levelCounts = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleDownload = () => {
    if (!onDownload) {
      // Default download implementation
      const logText = filteredLogs.map(log => 
        `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
      ).join('\n');
      
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-logs-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      onDownload();
    }
  };

  return (
    <Card className={cn("w-full", isExpanded && "fixed inset-4 z-50", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Service Logs
            {logs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredLogs.length} / {logs.length}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            
            {logs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Levels ({logs.length})
              </SelectItem>
              {Object.entries(levelCounts).map(([level, count]) => (
                <SelectItem key={level} value={level}>
                  <div className="flex items-center gap-2">
                    {getLevelIcon(level as ServiceLogEntry['level'])}
                    <span className="capitalize">{level} ({count})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Level summary badges */}
        {Object.keys(levelCounts).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(levelCounts).map(([level, count]) => (
              <Badge
                key={level}
                variant={levelFilter === level ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  levelFilter === level && getLevelColor(level as ServiceLogEntry['level'])
                )}
                onClick={() => setLevelFilter(levelFilter === level ? 'all' : level)}
              >
                {getLevelIcon(level as ServiceLogEntry['level'])}
                <span className="ml-1 capitalize">{level}: {count}</span>
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading logs...</span>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Terminal className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No logs available</h3>
            <p className="text-muted-foreground mb-4">
              No log entries have been generated yet, or logs may not be available for this service.
            </p>
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Logs
            </Button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No matching logs</h3>
            <p className="text-muted-foreground mb-4">
              No log entries match your current search and filter criteria.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
              <Button variant="outline" onClick={() => setLevelFilter('all')}>
                Clear Filters
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea 
            ref={scrollAreaRef}
            className={cn(
              "w-full",
              isExpanded ? "h-[calc(100vh-200px)]" : "h-96"
            )}
          >
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <LogEntry
                  key={`${log.timestamp}-${index}`}
                  entry={log}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </ScrollArea>
        )}
        
        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <div className="flex items-center justify-center p-2 border-t bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-refreshing every {refreshInterval / 1000}s</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ServiceLogsViewer;