import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PaasPlan } from '@/types/paas'
import { formatHourlyRate, formatMonthlyPrice } from '@/lib/currency'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  plans: PaasPlan[]
  currentPlanId?: string | null
  onSelect: (planId: string) => Promise<void>
}

export const PlanUpgradeModal: React.FC<Props> = ({ open, onOpenChange, plans, currentPlanId, onSelect }) => {
  const currentPlan = useMemo(() => plans.find(plan => plan.id === currentPlanId) || null, [plans, currentPlanId])
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const selectablePlans = useMemo(() => plans.filter(plan => plan.active), [plans])

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await onSelect(selected)
      setSelected(null)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const renderPlanCard = (plan: PaasPlan) => {
    const current = plan.id === currentPlanId
    const betterCpu = currentPlan && plan.cpu_millicores > currentPlan.cpu_millicores
    const betterMem = currentPlan && plan.memory_mb > currentPlan.memory_mb
    const betterStorage = currentPlan && plan.storage_gb > currentPlan.storage_gb
    return (
      <Card
        key={plan.id}
        className={`cursor-pointer border ${selected === plan.id ? 'border-primary' : ''}`}
        onClick={() => setSelected(plan.id)}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {plan.name}
            {current && <Badge variant="secondary">Current</Badge>}
          </CardTitle>
          <CardDescription>{formatHourlyRate(plan.price_hourly)} / hr • {formatMonthlyPrice(plan.price_monthly)} / mo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {plan.cpu_millicores}m CPU • {plan.memory_mb}MB RAM • {plan.storage_gb}GB SSD
          </div>
          {currentPlan && (
            <div className="text-xs text-muted-foreground">
              {betterCpu ? '▲' : '•'} CPU, {betterMem ? '▲' : '•'} Memory, {betterStorage ? '▲' : '•'} Storage compared to current plan
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={open} onOpenChange={openState => {
      if (!openState) setSelected(null)
      onOpenChange(openState)
    }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select a plan</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {selectablePlans.map(renderPlanCard)}
          {!selectablePlans.length && <p className="text-sm text-muted-foreground">No plans available.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!selected || saving}>
            {saving ? 'Updating…' : 'Apply plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
