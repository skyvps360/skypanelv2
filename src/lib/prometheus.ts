/**
 * Lightweight Prometheus client for the frontend.
 * Handles query_range requests and normalizes multi-stream responses.
 */

export interface PrometheusPoint {
  timestamp: number;
  value: number;
}

const PROMETHEUS_URL = import.meta.env.VITE_PROMETHEUS_URL || '';

export const isPrometheusConfigured = Boolean(PROMETHEUS_URL);

interface PrometheusQueryResponse {
  status: 'success' | 'error';
  data?: {
    resultType: 'matrix' | string;
    result: Array<{
      metric: Record<string, string>;
      values: [string, string][];
    }>;
  };
  errorType?: string;
  error?: string;
}

/**
 * Executes a Prometheus range query and returns aggregated datapoints.
 * When multiple result streams are returned, the values are summed per timestamp.
 */
export async function queryPrometheusRange(
  query: string,
  options: {
    start: number | Date;
    end: number | Date;
    stepSeconds: number;
    signal?: AbortSignal;
  }
): Promise<PrometheusPoint[]> {
  if (!isPrometheusConfigured) {
    throw new Error('Prometheus endpoint is not configured (set VITE_PROMETHEUS_URL)');
  }

  const startSeconds = Math.floor((options.start instanceof Date ? options.start.getTime() : options.start) / 1000);
  const endSeconds = Math.floor((options.end instanceof Date ? options.end.getTime() : options.end) / 1000);
  const step = Math.max(1, Math.floor(options.stepSeconds));

  const params = new URLSearchParams({
    query,
    start: startSeconds.toString(),
    end: endSeconds.toString(),
    step: `${step}s`,
  });

  const response = await fetch(`${PROMETHEUS_URL.replace(/\/$/, '')}/api/v1/query_range?${params.toString()}`, {
    method: 'GET',
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Prometheus query failed (${response.status}): ${errorText || response.statusText}`);
  }

  const payload = (await response.json()) as PrometheusQueryResponse;
  if (payload.status !== 'success' || !payload.data) {
    throw new Error(payload.error || 'Prometheus returned an error');
  }

  const points = new Map<number, number>();
  for (const stream of payload.data.result) {
    for (const [ts, value] of stream.values) {
      const timestamp = parseInt(ts, 10) * 1000;
      const numericValue = Number(value);
      if (Number.isNaN(numericValue)) {
        continue;
      }
      points.set(timestamp, (points.get(timestamp) || 0) + numericValue);
    }
  }

  return Array.from(points.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, value]) => ({ timestamp, value }));
}

