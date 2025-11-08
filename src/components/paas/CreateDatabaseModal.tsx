import React, { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildApiUrl } from '@/lib/api'
import { Loader2, AlertCircle } from 'lucide-react'

interface Plan {
  id: string
  name: string
  cpu_millicores: number
  memory_mb: number
  storage_gb: number
  price_hourly: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const DB_TYPES = [
  { value: 'mysql', label: 'MySQL', versions: ['8.0', '5.7'] },
  { value: 'postgresql', label: 'PostgreSQL', versions: ['16', '15', '14'] },
  { value: 'redis', label: 'Redis', versions: ['7.2', '7.0'] },
  { value: 'mongodb', label: 'MongoDB', versions: ['7.0', '6.0'] },
]

export const CreateDatabaseModal: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    db_type: '',
    version: '',
    plan_id: '',
  })

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const plansRes = await fetch(buildApiUrl('/paas/plans'))
          const plansData = await plansRes.json()
          setPlans(plansData.data || [])
        } catch (err: any) {
          setError(err?.message || 'Failed to load plans')
        }
      }
      void load()
    }
  }, [open])

  const selectedDbType = DB_TYPES.find((type) => type.value === formData.db_type)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (!formData.name || !formData.db_type || !formData.version || !formData.plan_id) {
        setError('All fields are required')
        return
      }

      setLoading(true)
      try {
        const res = await fetch(buildApiUrl('/paas/databases'), {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(formData),
        })

        const data = await res.json()
        if (data.success) {
          setFormData({ name: '', db_type: '', version: '', plan_id: '' })
          onSuccess()
        } else {
          setError(data.error || 'Failed to create database')
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to create database')
      } finally {
        setLoading(false)
      }
    },
    [formData, authHeaders, onSuccess]
  )

  const formatPrice = (hourly: number) => {
    return `$${hourly.toFixed(4)}/hr`
  }

  const formatResources = (plan: Plan) => {
    return `${plan.cpu_millicores}m CPU • ${plan.memory_mb}MB RAM • ${plan.storage_gb}GB`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Database</DialogTitle>
          <DialogDescription>
            Provision a new managed database instance for your applications
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start">
              <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Database Name</Label>
            <Input
              id="name"
              placeholder="my-database"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              A unique identifier for your database
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="db_type">Database Type</Label>
            <Select
              value={formData.db_type}
              onValueChange={(value) => {
                const type = DB_TYPES.find((t) => t.value === value)
                setFormData({ ...formData, db_type: value, version: type?.versions[0] || '' })
              }}
              disabled={loading}
            >
              <SelectTrigger id="db_type">
                <SelectValue placeholder="Select database type..." />
              </SelectTrigger>
              <SelectContent>
                {DB_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDbType && (
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Select
                value={formData.version}
                onValueChange={(value) => setFormData({ ...formData, version: value })}
                disabled={loading}
              >
                <SelectTrigger id="version">
                  <SelectValue placeholder="Select version..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedDbType.versions.map((version) => (
                    <SelectItem key={version} value={version}>
                      {selectedDbType.label} {version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="plan">Hosting Plan</Label>
            <Select
              value={formData.plan_id}
              onValueChange={(value) => setFormData({ ...formData, plan_id: value })}
              disabled={loading}
            >
              <SelectTrigger id="plan">
                <SelectValue placeholder="Select plan..." />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatPrice(plan.price_hourly)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatResources(plan)}
                    </div>
                  </SelectItem>
                ))}
                {plans.length === 0 && (
                  <SelectItem value="none" disabled>
                    No plans available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Resource allocation and pricing tier
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Database'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
