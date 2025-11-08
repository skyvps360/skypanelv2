import React, { useEffect, useState, useCallback, useRef } from 'react'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Terminal, Download, Loader2 } from 'lucide-react'

interface Props {
  applicationId: string
}

export const LogsTab: React.FC<Props> = ({ applicationId }) => {
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const authToken = localStorage.getItem('auth_token')

  const scrollToBottom = useCallback(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [autoScroll])

  useEffect(() => {
    scrollToBottom()
  }, [logs, scrollToBottom])

  useEffect(() => {
    // Connect to SSE endpoint for real-time logs
    const url = buildApiUrl(`/paas/applications/${applicationId}/logs?stream=true&token=${authToken}`)
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setLoading(false)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.chunk) {
          setLogs((prev) => prev + data.chunk)
        }
      } catch (err) {
        console.error('Failed to parse log event:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE error:', err)
      setLoading(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [applicationId, authToken])

  const handleDownload = useCallback(() => {
    const blob = new Blob([logs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${applicationId}-logs-${new Date().toISOString()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [logs, applicationId])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Runtime Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
            >
              Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!logs}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Connecting to log stream...</span>
          </div>
        ) : logs ? (
          <div className="relative">
            <pre className="bg-black text-green-400 p-4 rounded-md overflow-auto max-h-[600px] font-mono text-sm">
              {logs}
              <div ref={logsEndRef} />
            </pre>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No logs available yet. Logs will appear once the application starts.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
