import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { containerService } from '@/services/containerService'
import type { ContainerPlan, CreateContainerPlanRequest, UpdateContainerPlanRequest } from '@/types/containers'

interface PlanFormData {
  name: string
  description: string
  priceMonthly: string
  maxCpuCores: string
  maxMemoryGb: string
  maxStorageGb: string
  maxContainers: string
}

const initialFormData: PlanFormData = {
  name: '',
  description: '',
  priceMonthly: '',
  maxCpuCores: '',
  maxMemoryGb: '',
  maxStorageGb: '',
  maxContainers: ''
}

export default function ContainerPlansManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<ContainerPlan | null>(null)
  const [formData, setFormData] = useState<PlanFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Partial<PlanFormData>>({})
  
  const queryClient = useQueryClient()

  const { data: plansResponse, isLoading } = useQuery({
    queryKey: ['admin', 'container-plans'],
    queryFn: containerService.getAllPlans
  })

  const plans = plansResponse?.plans || []

  const createPlanMutation = useMutation({
    mutationFn: containerService.createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'container-plans'] })
      setIsCreateDialogOpen(false)
      setFormData(initialFormData)
      toast.success('Container plan created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create plan')
    }
  })

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContainerPlanRequest }) =>
      containerService.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'container-plans'] })
      setIsEditDialogOpen(false)
      setEditingPlan(null)
      setFormData(initialFormData)
      toast.success('Container plan updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update plan')
    }
  })

  const togglePlanMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? containerService.activatePlan(id) : containerService.deactivatePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'container-plans'] })
      toast.success('Plan status updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update plan status')
    }
  })

  const validateForm = (data: PlanFormData): boolean => {
    const errors: Partial<PlanFormData> = {}

    if (!data.name.trim()) {
      errors.name = 'Plan name is required'
    }

    if (!data.description.trim()) {
      errors.description = 'Description is required'
    }

    const price = parseFloat(data.priceMonthly)
    if (isNaN(price) || price < 0) {
      errors.priceMonthly = 'Valid price is required'
    }

    const cpuCores = parseInt(data.maxCpuCores)
    if (isNaN(cpuCores) || cpuCores < 1) {
      errors.maxCpuCores = 'CPU cores must be at least 1'
    }

    const memory = parseInt(data.maxMemoryGb)
    if (isNaN(memory) || memory < 1) {
      errors.maxMemoryGb = 'Memory must be at least 1 GB'
    }

    const storage = parseInt(data.maxStorageGb)
    if (isNaN(storage) || storage < 1) {
      errors.maxStorageGb = 'Storage must be at least 1 GB'
    }

    const containers = parseInt(data.maxContainers)
    if (isNaN(containers) || containers < 1) {
      errors.maxContainers = 'Container limit must be at least 1'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreatePlan = () => {
    if (!validateForm(formData)) return

    const planData: CreateContainerPlanRequest = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      priceMonthly: parseFloat(formData.priceMonthly),
      maxCpuCores: parseInt(formData.maxCpuCores),
      maxMemoryGb: parseInt(formData.maxMemoryGb),
      maxStorageGb: parseInt(formData.maxStorageGb),
      maxContainers: parseInt(formData.maxContainers)
    }

    createPlanMutation.mutate(planData)
  }

  const handleEditPlan = (plan: ContainerPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.priceMonthly.toString(),
      maxCpuCores: plan.maxCpuCores.toString(),
      maxMemoryGb: plan.maxMemoryGb.toString(),
      maxStorageGb: plan.maxStorageGb.toString(),
      maxContainers: plan.maxContainers.toString()
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePlan = () => {
    if (!editingPlan || !validateForm(formData)) return

    const planData: UpdateContainerPlanRequest = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      priceMonthly: parseFloat(formData.priceMonthly),
      maxCpuCores: parseInt(formData.maxCpuCores),
      maxMemoryGb: parseInt(formData.maxMemoryGb),
      maxStorageGb: parseInt(formData.maxStorageGb),
      maxContainers: parseInt(formData.maxContainers)
    }

    updatePlanMutation.mutate({ id: editingPlan.id, data: planData })
  }

  const handleTogglePlan = (plan: ContainerPlan) => {
    togglePlanMutation.mutate({ id: plan.id, active: !plan.active })
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setFormErrors({})
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const PlanForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Plan Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Starter Plan"
          />
          {formErrors.name && (
            <p className="text-sm text-red-500">{formErrors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceMonthly">Monthly Price ($)</Label>
          <Input
            id="priceMonthly"
            type="number"
            step="0.01"
            min="0"
            value={formData.priceMonthly}
            onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
            placeholder="9.99"
          />
          {formErrors.priceMonthly && (
            <p className="text-sm text-red-500">{formErrors.priceMonthly}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Plan description and features"
          rows={3}
        />
        {formErrors.description && (
          <p className="text-sm text-red-500">{formErrors.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxCpuCores">Max CPU Cores</Label>
          <Input
            id="maxCpuCores"
            type="number"
            min="1"
            value={formData.maxCpuCores}
            onChange={(e) => setFormData({ ...formData, maxCpuCores: e.target.value })}
            placeholder="2"
          />
          {formErrors.maxCpuCores && (
            <p className="text-sm text-red-500">{formErrors.maxCpuCores}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxMemoryGb">Max Memory (GB)</Label>
          <Input
            id="maxMemoryGb"
            type="number"
            min="1"
            value={formData.maxMemoryGb}
            onChange={(e) => setFormData({ ...formData, maxMemoryGb: e.target.value })}
            placeholder="4"
          />
          {formErrors.maxMemoryGb && (
            <p className="text-sm text-red-500">{formErrors.maxMemoryGb}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxStorageGb">Max Storage (GB)</Label>
          <Input
            id="maxStorageGb"
            type="number"
            min="1"
            value={formData.maxStorageGb}
            onChange={(e) => setFormData({ ...formData, maxStorageGb: e.target.value })}
            placeholder="20"
          />
          {formErrors.maxStorageGb && (
            <p className="text-sm text-red-500">{formErrors.maxStorageGb}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxContainers">Max Containers</Label>
          <Input
            id="maxContainers"
            type="number"
            min="1"
            value={formData.maxContainers}
            onChange={(e) => setFormData({ ...formData, maxContainers: e.target.value })}
            placeholder="5"
          />
          {formErrors.maxContainers && (
            <p className="text-sm text-red-500">{formErrors.maxContainers}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          variant="outline"
          onClick={() => {
            if (isEdit) {
              setIsEditDialogOpen(false)
              setEditingPlan(null)
            } else {
              setIsCreateDialogOpen(false)
            }
            resetForm()
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={isEdit ? handleUpdatePlan : handleCreatePlan}
          disabled={isEdit ? updatePlanMutation.isPending : createPlanMutation.isPending}
        >
          {isEdit ? 'Update Plan' : 'Create Plan'}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Container Plans</h1>
          <p className="text-muted-foreground">
            Manage container hosting plans and pricing
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Container Plan</DialogTitle>
            </DialogHeader>
            <PlanForm />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Container Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Resources</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {plan.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(plan.priceMonthly)}/month
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div>{plan.maxCpuCores} CPU cores</div>
                        <div>{plan.maxMemoryGb} GB RAM</div>
                        <div>{plan.maxStorageGb} GB storage</div>
                        <div>{plan.maxContainers} containers</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.active ? 'default' : 'secondary'}>
                        {plan.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePlan(plan)}
                          disabled={togglePlanMutation.isPending}
                        >
                          {plan.active ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPlan(plan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No container plans found. Create your first plan to get started.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Container Plan</DialogTitle>
          </DialogHeader>
          <PlanForm isEdit />
        </DialogContent>
      </Dialog>
    </div>
  )
}