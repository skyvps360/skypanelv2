import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  Terminal,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { apiClient, buildApiUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Deployment {
  id: string;
  version: number;
  status: string;
  build_started_at?: string;
  build_completed_at?: string;
  deployed_at?: string;
  error_message?: string;
}

interface JobStatus {
  id: string;
  queue: string;
  state: string;
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  returnValue?: {
    deploymentId?: string;
  };
}

interface DeploymentProgressProps {
  appId: string;
  jobInfo?: {
    jobId: string;
    queue?: string;
  } | null;
  onJobComplete?: (payload: { success: boolean; job?: JobStatus }) => void;
  onDeploymentUpdated?: () => void;
}

const STAGES = [
  { label: 'Clone', description: 'Fetch repository & branch' },
  { label: 'Build', description: 'Buildpack install & build' },
  { label: 'Package', description: 'Create slug artifact' },
  { label: 'Deploy', description: 'Push to Swarm & start' },
] as const;

const IN_PROGRESS_STATUSES = new Set(['pending', 'building', 'deploying']);
const LOG_LIMIT = 400;

export const DeploymentProgress: React.FC<DeploymentProgressProps> = ({
  appId,
  jobInfo,
  onJobComplete,
  onDeploymentUpdated,
}) => {
  const { token } = useAuth();
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [trackedDeploymentId, setTrackedDeploymentId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const jobStateRef = useRef<string | null>(null);

  const hasActiveDeployment = deployment
    ? IN_PROGRESS_STATUSES.has(deployment.status)
    : false;

  const stageIndex = useMemo(() => {
    if (deployment?.status === 'deployed' || deployment?.status === 'rolled_back') {
      return STAGES.length - 1;
    }
    if (deployment?.status === 'build_failed' || deployment?.status === 'failed') {
      return 1;
    }
    if (deployment?.status === 'deploying') {
      return 3;
    }
    if (jobStatus?.progress) {
      if (jobStatus.progress >= 90) return 3;
      if (jobStatus.progress >= 60) return 2;
      if (jobStatus.progress >= 30) return 1;
    }
    if (deployment?.status === 'building') {
      return 1;
    }
    return 0;
  }, [deployment, jobStatus]);

  const pollJobStatus = useCallback(async () => {
    if (!jobInfo?.jobId) {
      setJobStatus(null);
      return;
    }
    try {
      const queueQuery = jobInfo.queue ? `?queue=${encodeURIComponent(jobInfo.queue)}` : '';
      const data = await apiClient.get<JobStatus>(`/paas/jobs/${jobInfo.jobId}${queueQuery}`);
      setJobStatus(data);
      setLastUpdated(new Date().toISOString());

      if (data.returnValue?.deploymentId && data.returnValue.deploymentId !== trackedDeploymentId) {
        setTrackedDeploymentId(data.returnValue.deploymentId);
        onDeploymentUpdated?.();
      }

      if (['completed', 'failed'].includes(data.state) && jobStateRef.current !== data.state) {
        jobStateRef.current = data.state;
        onJobComplete?.({ success: data.state === 'completed', job: data });
      }
    } catch (error: any) {
      if (String(error?.message || '').includes('404')) {
        setJobStatus(null);
        return;
      }
      console.error('Failed to poll job status:', error);
    }
  }, [jobInfo, onJobComplete, trackedDeploymentId, onDeploymentUpdated]);

  const loadLatestDeployment = useCallback(async () => {
    try {
      const response = await apiClient.get<{ deployments: Deployment[] }>(`/paas/apps/${appId}/deployments`);
      const latest = response.deployments?.[0] || null;
      setDeployment(latest);
      if (latest && !trackedDeploymentId) {
        setTrackedDeploymentId(latest.id);
      }
    } catch (error: any) {
      console.error('Failed to load deployments:', error);
    }
  }, [appId, trackedDeploymentId]);

  useEffect(() => {
    pollJobStatus();
    const interval = setInterval(pollJobStatus, 5000);
    return () => clearInterval(interval);
  }, [pollJobStatus]);

  useEffect(() => {
    loadLatestDeployment();
    const interval = setInterval(loadLatestDeployment, 5000);
    return () => clearInterval(interval);
  }, [loadLatestDeployment]);

  useEffect(() => {
    if (!logEndRef.current) return;
    logEndRef.current.scrollIntoView({ behavior: hasActiveDeployment ? 'smooth' : 'auto' });
  }, [logs, hasActiveDeployment]);

  const appendLog = useCallback((message: string) => {
    setLogs((current) => {
      const next = [...current, message];
      if (next.length > LOG_LIMIT) {
        next.splice(0, next.length - LOG_LIMIT);
      }
      return next;
    });
  }, []);

  const stopStream = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setStreaming(false);
  }, []);

  useEffect(() => {
    const shouldStream = Boolean(token && (jobInfo?.jobId || hasActiveDeployment));
    if (!shouldStream) {
      stopStream();
      return;
    }

    const controller = new AbortController();
    streamAbortRef.current = controller;

    const streamLogs = async () => {
      try {
        setStreaming(true);
        setStreamError(null);
        const response = await fetch(buildApiUrl(`/paas/apps/${appId}/logs/stream`), {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
          signal: controller.signal,
        });

        if (!response.body) {
          throw new Error('Streaming not supported in this browser');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
            if (dataLine) {
              try {
                const payload = JSON.parse(dataLine.replace(/^data:\s*/, ''));
                if (payload?.message) {
                  appendLog(`[${payload.timestamp}] ${payload.message}`);
                }
              } catch (error) {
                console.warn('Failed to parse log event', error);
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        console.error('Log stream error:', error);
        setStreamError(error?.message || 'Log stream disconnected');
      } finally {
        setStreaming(false);
      }
    };

    streamLogs();

    return () => {
      controller.abort();
    };
  }, [token, jobInfo, hasActiveDeployment, appId, appendLog, stopStream]);

  const deploymentStatusLabel = deployment
    ? deployment.status.replace('_', ' ')
    : 'No deployments yet';

  const jobStateLabel = jobStatus?.state || (hasActiveDeployment ? 'deploying' : 'idle');

  const renderStageIcon = (index: number) => {
    if (deployment?.status && deployment.status.includes('failed') && stageIndex >= index) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (index < stageIndex) {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    }
    if (index === stageIndex && (hasActiveDeployment || jobStatus)) {
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment Progress</CardTitle>
        <CardDescription>
          {jobInfo?.jobId ? `Tracking job ${jobInfo.jobId}` : 'Latest deployment status'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Deployment Status</p>
            <p className="font-semibold capitalize">{deploymentStatusLabel}</p>
            {deployment?.deployed_at && (
              <p className="text-xs text-muted-foreground">
                Completed {new Date(deployment.deployed_at).toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Queue State</p>
            <Badge variant="outline" className="capitalize">
              {jobStateLabel}
            </Badge>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                pollJobStatus();
                loadLatestDeployment();
                toast.success('Deployment status refreshed');
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              disabled={logs.length === 0}
            >
              Clear Logs
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {STAGES.map((stage, index) => (
              <div key={stage.label} className="flex items-center gap-3">
                <div>{renderStageIcon(index)}</div>
                <div>
                  <p className="text-sm font-medium">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.description}</p>
                </div>
              </div>
            ))}
          </div>
          {jobStatus && (
            <div>
              <Progress value={Number(jobStatus.progress || 0)} />
              <p className="text-xs text-muted-foreground mt-1">
                Job progress: {Math.round(jobStatus.progress || 0)}%
              </p>
              {jobStatus.failedReason && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {jobStatus.failedReason}
                </p>
              )}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Build & deploy logs
              </p>
              {streamError && <p className="text-xs text-destructive">{streamError}</p>}
            </div>
            <Badge variant={streaming ? 'default' : 'secondary'}>
              {streaming ? 'Streaming' : 'Idle'}
            </Badge>
          </div>
          <div className="rounded-md border bg-black text-green-400 font-mono text-xs h-64 overflow-y-auto p-3">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No log output yet.</p>
            ) : (
              <div>
                {logs.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
