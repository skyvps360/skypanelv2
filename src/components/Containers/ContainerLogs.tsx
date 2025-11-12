/**
 * Container Logs Component
 * Real-time log streaming with filtering and download functionality
 */

import { useState, useEffect, useRef } from "react";
import { Download, Search, ArrowDown, Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  containerId?: string;
}

interface ContainerLogsProps {
  serviceId: string;
  onFetchLogs: (params: {
    lines?: number;
    since?: string;
    level?: string;
    search?: string;
  }) => Promise<LogEntry[]>;
  isStreaming?: boolean;
}

const LOG_LEVELS = ["ALL", "ERROR", "WARN", "INFO", "DEBUG"];

const getLogLevelColor = (level: string): string => {
  switch (level.toUpperCase()) {
    case "ERROR":
      return "text-red-500";
    case "WARN":
      return "text-yellow-500";
    case "INFO":
      return "text-blue-500";
    case "DEBUG":
      return "text-gray-500";
    default:
      return "text-foreground";
  }
};

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export function ContainerLogs({
  serviceId,
  onFetchLogs,
  isStreaming = false,
}: ContainerLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [lineCount, setLineCount] = useState("100");
  const [wrapLines, setWrapLines] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch logs
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = {
        lines: parseInt(lineCount),
      };

      if (levelFilter !== "ALL") {
        params.level = levelFilter;
      }

      if (searchTerm) {
        params.search = searchTerm;
      }

      const fetchedLogs = await onFetchLogs(params);
      setLogs(fetchedLogs);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // Auto-refresh when streaming and not paused
  useEffect(() => {
    if (isStreaming && !isPaused) {
      const interval = setInterval(() => {
        fetchLogs();
      }, 3000); // Refresh every 3 seconds

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isPaused, serviceId]);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const downloadLogs = () => {
    const logText = logs
      .map((log) => `[${formatTimestamp(log.timestamp)}] [${log.level}] ${log.message}`)
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `container-logs-${serviceId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Logs downloaded successfully");
  };

  const filteredLogs = logs.filter((log) => {
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="log-level">Log Level</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger id="log-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="line-count">Lines</Label>
              <Select value={lineCount} onValueChange={setLineCount}>
                <SelectTrigger id="line-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">Last 50</SelectItem>
                  <SelectItem value="100">Last 100</SelectItem>
                  <SelectItem value="500">Last 500</SelectItem>
                  <SelectItem value="1000">Last 1000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={fetchLogs} disabled={loading} className="flex-1">
                Refresh
              </Button>
              <Button variant="outline" onClick={downloadLogs} disabled={logs.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-scroll"
                checked={autoScroll}
                onCheckedChange={(checked) => setAutoScroll(!!checked)}
              />
              <Label htmlFor="auto-scroll" className="text-sm">
                Auto-scroll
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="wrap-lines"
                checked={wrapLines}
                onCheckedChange={(checked) => setWrapLines(!!checked)}
              />
              <Label htmlFor="wrap-lines" className="text-sm">
                Wrap lines
              </Label>
            </div>

            {isStreaming && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Logs ({filteredLogs.length} {filteredLogs.length === 1 ? "entry" : "entries"})
          </CardTitle>
          {!autoScroll && (
            <Button variant="outline" size="sm" onClick={scrollToBottom}>
              <ArrowDown className="h-4 w-4 mr-2" />
              Scroll to Bottom
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div
            ref={logsContainerRef}
            className="bg-black text-green-400 rounded p-4 h-[600px] overflow-y-auto font-mono text-xs"
          >
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No logs found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`${wrapLines ? "whitespace-pre-wrap" : "whitespace-nowrap"}`}
                  >
                    <span className="text-gray-500">
                      [{formatTimestamp(log.timestamp)}]
                    </span>{" "}
                    <span className={getLogLevelColor(log.level)}>[{log.level}]</span>{" "}
                    <span className="text-green-400">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
