import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  maxProjects: string
}

const initialFormData: PlanFormData = {
  name: '',
  description: '',
  priceMonthly: '',
  maxCpuCores: '',
  maxMemoryGb: '',
  maxStorageGb: '',
  maxContainers: '',
  maxProjects: '1'
}

interface PlanFormProps {
  isEdit?: boolean
  formData: PlanFormData
  formErrors: Partial<PlanFormData>
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPriceChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onCpuCoresChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onMemoryChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onStorageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onContainersChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onProjectsChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCancel: () => void
  onSubmit: () => void
  isPending: boolean
}

const PlanForm = React.memo(({ 
  isEdit = false,
  formData,
  formErrors,
  onNameChange,
  onPriceChange,
  onDescriptionChange,
  onCpuCoresChange,
  onMemoryChange,
  onStorageChange,
  onContainersChange,
  onProjectsChange,
  onCancel,
  onSubmit,
  isPending
}: PlanFormProps) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Plan Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={onNameChange}
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
          onChange={onPriceChange}
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
        onChange={onDescriptionChange}
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
          step="0.1"
          min="0.1"
          value={formData.maxCpuCores}
          onChange={onCpuCoresChange}
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
          step="0.1"
          min="0.1"
          value={formData.maxMemoryGb}
          onChange={onMemoryChange}
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
          onChange={onStorageChange}
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
          onChange={onContainersChange}
          placeholder="5"
        />
        {formErrors.maxContainers && (
          <p className="text-sm text-red-500">{formErrors.maxContainers}</p>
        )}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="maxProjects">Max Projects</Label>
        <Input
          id="maxProjects"
          type="number"
          min="1"
          value={formData.maxProjects}
          onChange={onProjectsChange}
          placeholder="1"
        />
        {formErrors.maxProjects && (
          <p className="text-sm text-red-500">{formErrors.maxProjects}</p>
        )}
      </div>
    </div>

    <div className="flex justify-end space-x-2 pt-4">
      <Button
        variant="outline"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        onClick={onSubmit}
        disabled={isPending}
      >
        {isEdit ? 'Update Plan' : 'Create Plan'}
      </Button>
    </div>
  </div>
))

export default function ContainerPlansManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<ContainerPlan | null>(null)
  const [deletingPlan, setDeletingPlan] = useState<ContainerPlan | null>(null)
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

  const deletePlanMutation = useMutation({
    mutationFn: containerService.deletePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'container-plans'] })
      setIsDeleteDialogOpen(false)
      setDeletingPlan(null)
      toast.success('Container plan deleted successfully')
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Failed to delete plan'
      toast.error(errorMessage)
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

    const cpuCores = parseFloat(data.maxCpuCores)
    if (isNaN(cpuCores) || cpuCores < 0.1) {
      errors.maxCpuCores = 'CPU cores must be at least 0.1'
    }

    const memory = parseFloat(data.maxMemoryGb)
    if (isNaN(memory) || memory < 0.1) {
      errors.maxMemoryGb = 'Memory must be at least 0.1 GB'
    }

    const storage = parseInt(data.maxStorageGb)
    if (isNaN(storage) || storage < 1) {
      errors.maxStorageGb = 'Storage must be at least 1 GB'
    }

    const containers = parseInt(data.maxContainers)
    if (isNaN(containers) || containers < 1) {
      errors.maxContainers = 'Container limit must be at least 1'
    }

    const projects = parseInt(data.maxProjects)
    if (isNaN(projects) || projects < 1) {
      errors.maxProjects = 'Project limit must be at least 1'
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
      maxCpuCores: parseFloat(formData.maxCpuCores),
      maxMemoryGb: parseFloat(formData.maxMemoryGb),
      maxStorageGb: parseInt(formData.maxStorageGb),
      maxContainers: parseInt(formData.maxContainers),
      maxProjects: parseInt(formData.maxProjects)
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
      maxContainers: plan.maxContainers.toString(),
      maxProjects: plan.maxProjects.toString()
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePlan = () => {
    if (!editingPlan || !validateForm(formData)) return

    const planData: UpdateContainerPlanRequest = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      priceMonthly: parseFloat(formData.priceMonthly),
      maxCpuCores: parseFloat(formData.maxCpuCores),
      maxMemoryGb: parseFloat(formData.maxMemoryGb),
      maxStorageGb: parseInt(formData.maxStorageGb),
      maxContainers: parseInt(formData.maxContainers),
      maxProjects: parseInt(formData.maxProjects)
    }

    updatePlanMutation.mutate({ id: editingPlan.id, data: planData })
  }

  const handleTogglePlan = (plan: ContainerPlan) => {
    togglePlanMutation.mutate({ id: plan.id, active: !plan.active })
  }

  const handleDeletePlan = (plan: ContainerPlan) => {
    setDeletingPlan(plan)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeletePlan = () => {
    if (!deletingPlan) return
    deletePlanMutation.mutate(deletingPlan.id)
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

  // Memoize form handlers to prevent recreating them on every render
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, name: e.target.value }))
  }, [])

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, priceMonthly: e.target.value }))
  }, [])

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, description: e.target.value }))
  }, [])

  const handleCpuCoresChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, maxCpuCores: e.target.value }))
  }, [])

  const handleMemoryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, maxMemoryGb: e.target.value }))
  }, [])

  const handleStorageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, maxStorageGb: e.target.value }))
  }, [])

  const handleContainersChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, maxContainers: e.target.value }))
  }, [])

  const handleProjectsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, maxProjects: e.target.value }))
  }, [])

  const handleCancel = useCallback(() => {
    if (isEditDialogOpen) {
      setIsEditDialogOpen(false)
      setEditingPlan(null)
    } else {
      setIsCreateDialogOpen(false)
    }
    resetForm()
  }, [isEditDialogOpen])


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
            <PlanForm
              formData={formData}
              formErrors={formErrors}
              onNameChange={handleNameChange}
              onPriceChange={handlePriceChange}
              onDescriptionChange={handleDescriptionChange}
              onCpuCoresChange={handleCpuCoresChange}
              onMemoryChange={handleMemoryChange}
              onStorageChange={handleStorageChange}
              onContainersChange={handleContainersChange}
              onProjectsChange={handleProjectsChange}
              onCancel={handleCancel}
              onSubmit={handleCreatePlan}
              isPending={createPlanMutation.isPending}
            />
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
                          title={plan.active ? 'Deactivate plan' : 'Activate plan'}
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
                          title="Edit plan"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePlan(plan)}
                          disabled={deletePlanMutation.isPending}
                          title="Delete plan"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
          <PlanForm
            isEdit
            formData={formData}
            formErrors={formErrors}
            onNameChange={handleNameChange}
            onPriceChange={handlePriceChange}
            onDescriptionChange={handleDescriptionChange}
            onCpuCoresChange={handleCpuCoresChange}
            onMemoryChange={handleMemoryChange}
            onStorageChange={handleStorageChange}
            onContainersChange={handleContainersChange}
            onProjectsChange={handleProjectsChange}
            onCancel={handleCancel}
            onSubmit={handleUpdatePlan}
            isPending={updatePlanMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Container Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the plan "{deletingPlan?.name}"? 
              This action cannot be undone.
              {deletingPlan?.active && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-500">
                  Note: This plan is currently active. It can only be deleted if there are no active subscriptions.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deletePlanMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePlan}
              disabled={deletePlanMutation.isPending}
            >
              {deletePlanMutation.isPending ? 'Deleting...' : 'Delete Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}