import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Eye, EyeOff, Settings, FileCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { containerService } from '@/services/containerService'
import type { ContainerTemplate, CreateTemplateRequest, UpdateTemplateRequest } from '@/types/containers'

interface TemplateFormData {
  templateName: string
  displayName: string
  description: string
  category: string
  displayOrder: string
  templateSchema: string
}

const initialFormData: TemplateFormData = {
  templateName: '',
  displayName: '',
  description: '',
  category: '',
  displayOrder: '0',
  templateSchema: ''
}

const defaultCategories = [
  'Web Applications',
  'Databases',
  'Development Tools',
  'Monitoring',
  'Communication',
  'Content Management',
  'E-commerce',
  'Analytics',
  'Other'
]

export default function ContainerTemplatesManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContainerTemplate | null>(null)
  const [configTemplate, setConfigTemplate] = useState<ContainerTemplate | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Partial<TemplateFormData>>({})
  
  const queryClient = useQueryClient()

  const { data: templatesResponse, isLoading } = useQuery({
    queryKey: ['admin', 'container-templates'],
    queryFn: containerService.getAllTemplates
  })

  const templates = templatesResponse?.templates || []

  const createTemplateMutation = useMutation({
    mutationFn: containerService.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'container-templates'] })
      setIsCreateDialogOpen(false)
      setFormData(initialFormData)
      toast.success('Template created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create template')
    }
  })

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateRequest }) =>
      containerService.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'container-templates'] })
      setIsEditDialogOpen(false)
      setEditingTemplate(null)
      setFormData(initialFormData)
      toast.success('Template updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update template')
    }
  })

  const toggleTemplateMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? containerService.enableTemplate(id) : containerService.disableTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'container-templates'] })
      toast.success('Template status updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update template status')
    }
  })

  const validateForm = (data: TemplateFormData): boolean => {
    const errors: Partial<TemplateFormData> = {}

    if (!data.templateName.trim()) {
      errors.templateName = 'Template name is required'
    } else if (!/^[a-z0-9-_]+$/.test(data.templateName)) {
      errors.templateName = 'Template name must contain only lowercase letters, numbers, hyphens, and underscores'
    }

    if (!data.displayName.trim()) {
      errors.displayName = 'Display name is required'
    }

    if (!data.description.trim()) {
      errors.description = 'Description is required'
    }

    if (!data.category.trim()) {
      errors.category = 'Category is required'
    }

    const displayOrder = parseInt(data.displayOrder)
    if (isNaN(displayOrder) || displayOrder < 0) {
      errors.displayOrder = 'Display order must be a non-negative number'
    }

    if (!data.templateSchema.trim()) {
      errors.templateSchema = 'Template schema is required'
    } else {
      try {
        JSON.parse(data.templateSchema)
      } catch {
        errors.templateSchema = 'Template schema must be valid JSON'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateTemplate = () => {
    if (!validateForm(formData)) return

    const templateData: CreateTemplateRequest = {
      templateName: formData.templateName.trim(),
      displayName: formData.displayName.trim(),
      description: formData.description.trim(),
      category: formData.category.trim(),
      displayOrder: parseInt(formData.displayOrder),
      templateSchema: JSON.parse(formData.templateSchema)
    }

    createTemplateMutation.mutate(templateData)
  }

  const handleEditTemplate = (template: ContainerTemplate) => {
    setEditingTemplate(template)
    setFormData({
      templateName: template.templateName,
      displayName: template.displayName,
      description: template.description,
      category: template.category,
      displayOrder: template.displayOrder.toString(),
      templateSchema: JSON.stringify(template.templateSchema, null, 2)
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateTemplate = () => {
    if (!editingTemplate || !validateForm(formData)) return

    const templateData: UpdateTemplateRequest = {
      displayName: formData.displayName.trim(),
      description: formData.description.trim(),
      category: formData.category.trim(),
      displayOrder: parseInt(formData.displayOrder),
      templateSchema: JSON.parse(formData.templateSchema)
    }

    updateTemplateMutation.mutate({ id: editingTemplate.id, data: templateData })
  }

  const handleToggleTemplate = (template: ContainerTemplate) => {
    toggleTemplateMutation.mutate({ id: template.id, enabled: !template.enabled })
  }

  const handleViewConfig = (template: ContainerTemplate) => {
    setConfigTemplate(template)
    setIsConfigDialogOpen(true)
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setFormErrors({})
  }

  const TemplateForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="templateName">Template Name</Label>
          <Input
            id="templateName"
            value={formData.templateName}
            onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
            placeholder="e.g., wordpress"
            disabled={isEdit}
          />
          {formErrors.templateName && (
            <p className="text-sm text-red-500">{formErrors.templateName}</p>
          )}
          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, hyphens, and underscores only
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="e.g., WordPress"
          />
          {formErrors.displayName && (
            <p className="text-sm text-red-500">{formErrors.displayName}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Template description and features"
          rows={3}
        />
        {formErrors.description && (
          <p className="text-sm text-red-500">{formErrors.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {defaultCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formErrors.category && (
            <p className="text-sm text-red-500">{formErrors.category}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayOrder">Display Order</Label>
          <Input
            id="displayOrder"
            type="number"
            min="0"
            value={formData.displayOrder}
            onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
            placeholder="0"
          />
          {formErrors.displayOrder && (
            <p className="text-sm text-red-500">{formErrors.displayOrder}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="templateSchema">Template Schema (JSON)</Label>
        <Textarea
          id="templateSchema"
          value={formData.templateSchema}
          onChange={(e) => setFormData({ ...formData, templateSchema: e.target.value })}
          placeholder='{"services": [...]}'
          rows={10}
          className="font-mono text-sm"
        />
        {formErrors.templateSchema && (
          <p className="text-sm text-red-500">{formErrors.templateSchema}</p>
        )}
        <p className="text-xs text-muted-foreground">
          JSON schema defining the template configuration
        </p>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          variant="outline"
          onClick={() => {
            if (isEdit) {
              setIsEditDialogOpen(false)
              setEditingTemplate(null)
            } else {
              setIsCreateDialogOpen(false)
            }
            resetForm()
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={isEdit ? handleUpdateTemplate : handleCreateTemplate}
          disabled={isEdit ? updateTemplateMutation.isPending : createTemplateMutation.isPending}
        >
          {isEdit ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  )

  return (
    <div>
      {/* Clean Hero Section - matching admin dashboard style */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8 mb-6">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">
              Container Platform
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Container Templates
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Manage available application templates for container deployment
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Container Template</DialogTitle>
              </DialogHeader>
              <TemplateForm />
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <FileCode className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Container Templates</CardTitle>
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
                  <TableHead>Template</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.displayName}</div>
                        <div className="text-sm text-muted-foreground">
                          {template.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {template.templateName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={template.enabled}
                          onCheckedChange={() => handleToggleTemplate(template)}
                          disabled={toggleTemplateMutation.isPending}
                        />
                        <span className="text-sm">
                          {template.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.displayOrder}
                    </TableCell>
                    <TableCell>
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewConfig(template)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No templates found. Create your first template to get started.
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Container Template</DialogTitle>
          </DialogHeader>
          <TemplateForm isEdit />
        </DialogContent>
      </Dialog>

      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Configuration</DialogTitle>
          </DialogHeader>
          {configTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template Name</Label>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {configTemplate.templateName}
                  </p>
                </div>
                <div>
                  <Label>Display Name</Label>
                  <p className="text-sm bg-muted p-2 rounded">
                    {configTemplate.displayName}
                  </p>
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <p className="text-sm bg-muted p-2 rounded">
                  {configTemplate.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <p className="text-sm bg-muted p-2 rounded">
                    {configTemplate.category}
                  </p>
                </div>
                <div>
                  <Label>Display Order</Label>
                  <p className="text-sm bg-muted p-2 rounded">
                    {configTemplate.displayOrder}
                  </p>
                </div>
              </div>

              <div>
                <Label>Template Schema</Label>
                <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(configTemplate.templateSchema, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsConfigDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}