import React, { useEffect, useMemo, useState } from 'react'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatHourlyRate, formatMonthlyPrice } from '@/lib/currency'

interface Plan {
  id: string
  name: string
  cpu_millicores: number
  memory_mb: number
  storage_gb: number
  price_hourly: number
  price_monthly: number
  supported_runtimes?: string[]
}

const PaaS: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(buildApiUrl('/paas/plans'))
        const data = await res.json()
        setPlans(data.data || [])
      } catch (err: any) {
        setError(err?.message || 'Unable to load plans')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const heroCopy = useMemo(() => ({
    title: 'Deploy apps in minutes',
    subtitle: 'Git-based deployments, managed databases, and real-time metrics backed by SkyPanel infrastructure.',
  }), [])

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">{heroCopy.title}</h1>
          <p className="text-muted-foreground">{heroCopy.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="lg">
            <a href="/register">Get Started</a>
          </Button>
          <Button variant="outline" asChild size="lg">
            <a href="/contact">Talk to sales</a>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`skeleton-${idx}`} className="p-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          ))}

        {!loading && plans.map(p => {
          const runtimeBadges = Array.isArray(p.supported_runtimes)
            ? p.supported_runtimes.slice(0, 3)
            : []

          return (
            <Card key={p.id} className="flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>
                    {p.cpu_millicores}m CPU • {p.memory_mb}MB RAM • {p.storage_gb}GB SSD
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-semibold">{formatHourlyRate(p.price_hourly)}<span className="text-base font-normal text-muted-foreground">/hr</span></div>
                    <div className="text-sm text-muted-foreground">{formatMonthlyPrice(p.price_monthly)} / month</div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="font-medium text-muted-foreground">What&apos;s included</div>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Git-based deployments</li>
                      <li>• Managed TLS + custom domains</li>
                      <li>• 1-click database attachments</li>
                    </ul>
                  </div>
                  {runtimeBadges.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {runtimeBadges.map(rt => (
                        <Badge key={rt} variant="secondary">{rt}</Badge>
                      ))}
                      {Array.isArray(p.supported_runtimes) && p.supported_runtimes.length > runtimeBadges.length && (
                        <Badge variant="outline">+{p.supported_runtimes.length - runtimeBadges.length} more</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </div>
              <CardContent className="pt-0">
                <Button variant="secondary" className="w-full" asChild>
                  <a href="/register">Launch now</a>
                </Button>
              </CardContent>
            </Card>
          )
        })}

        {!loading && !plans.length && (
          <Card>
            <CardHeader>
              <CardTitle>Coming soon</CardTitle>
              <CardDescription>PaaS plans are not yet configured by admin.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  )
}

export default PaaS
