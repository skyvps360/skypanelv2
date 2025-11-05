import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, TestTube, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { containerService } from '@/services/containerService'

interface CaasConfig {
  id?: string
  apiUrl: string
  apiKey?: string
  hasApiKey?: boolean
  status?: 'healthy' | 'degraded' | 'unknown'
  lastConnectionTest?: string
  connectionStatus?: 'success' | 'failed' | 'pending' | 'connected' | 'healthy'
  source?: 'db' | 'env' | 'none'
}

interface ConfigFormData {
  apiUrl: string
  apiKey: string
}

interface CaasConfigRequest {
  apiUrl: string
  apiKey?: string
}

const initialFormData: ConfigFormData = {
  apiUrl: 'http://localhost:2375',
  apiKey: ''
}

export default function CaasConfig() {
  const [formData, setFormData] = useState<ConfigFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Partial<ConfigFormData>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error' | null
    message: string
  }>({ status: null, message: '' })

  const queryClient = useQueryClient()

  const { data: configResponse, isLoading } = useQuery({
    queryKey: ['admin', 'caas-config'],
    queryFn: containerService.getCaasConfig
  })

  const config = configResponse?.config

  const saveConfigMutation = useMutation({
    mutationFn: containerService.updateCaasConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'caas-config'] })
      setHasChanges(false)
      // Clear the API key field after successful save for security
      setFormData(prev => ({ ...prev, apiKey: '' }))
      toast.success('Container platform configuration saved successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.error?.message || 'Failed to save configuration'
      toast.error(errorMessage)
    }
  })

  const testConnectionMutation = useMutation({
    mutationFn: containerService.testCaasConnection,
    onSuccess: async (result) => {
      // Invalidate and refetch to get updated connection status
      await queryClient.refetchQueries({ queryKey: ['admin', 'caas-config'] })
      setTestResult({
        status: 'success',
        message: result.message || 'Connection test successful'
      })
      toast.success('Container platform connection test successful')
    },
    onError: async (error: any) => {
      // Still refetch to get updated status even on error
      await queryClient.refetchQueries({ queryKey: ['admin', 'caas-config'] })
      const errorMessage = error?.message || error?.response?.data?.error?.message || 'Connection test failed'
      setTestResult({
        status: 'error',
        message: errorMessage
      })
      toast.error(errorMessage)
    }
  })

  // Load config data into form when available
  useEffect(() => {
    if (config) {
      setFormData(prev => ({
        ...prev,
        apiUrl: config.apiUrl || 'http://localhost:2375',
        // Only clear API key if we're loading for the first time and there's no existing key
        apiKey: prev.apiKey || ''
      }))
    }
  }, [config])

  // Track form changes
  useEffect(() => {
    if (config) {
      const hasApiUrlChange = formData.apiUrl !== (config.apiUrl || '')
      const hasApiKeyChange = formData.apiKey !== ''
      setHasChanges(hasApiUrlChange || hasApiKeyChange)
    }
  }, [formData, config])

  const validateForm = (): boolean => {
    const errors: Partial<ConfigFormData> = {}

    if (!formData.apiUrl.trim()) {
      errors.apiUrl = 'API URL is required'
    } else {
      try {
        new URL(formData.apiUrl)
      } catch {
        errors.apiUrl = 'Please enter a valid URL'
      }
    }

    // Only require API key if we don't have one saved or if user is trying to update it
    if (!formData.apiKey.trim() && !config?.hasApiKey) {
      errors.apiKey = 'API Key is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveConfig = () => {
    if (!validateForm()) return

    const configData: CaasConfigRequest = {
      apiUrl: formData.apiUrl.trim()
    }

    // Only include API key if user provided one
    if (formData.apiKey.trim()) {
      configData.apiKey = formData.apiKey.trim()
    }

    saveConfigMutation.mutate(configData)
  }

  const handleTestConnection = () => {
    if (!validateForm()) return

    setTestResult({ status: null, message: '' })
    
    const configData: CaasConfigRequest = {
      apiUrl: formData.apiUrl.trim()
    }

    // Only include API key if user provided one
    if (formData.apiKey.trim()) {
      configData.apiKey = formData.apiKey.trim()
    }

    testConnectionMutation.mutate(configData)
  }

  const handleInputChange = (field: keyof ConfigFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear test result when form changes
    if (testResult.status) {
      setTestResult({ status: null, message: '' })
    }
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const getConnectionStatusBadge = () => {
    if (!config?.connectionStatus && !config?.status) return null

    // Normalize the status values from backend
    const normalizedStatus = config.connectionStatus === 'connected' || config.status === 'healthy' ? 'success' : 
                             config.connectionStatus || config.status

    switch (normalizedStatus) {
      case 'success':
      case 'healthy':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )
      case 'failed':
      case 'degraded':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case 'pending':
      case 'unknown':
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return null
    }
  }

  const formatLastTest = (dateString?: string) => {
    if (!dateString) return 'Never tested'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-3">
            Container Platform
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Container Platform Configuration
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Configure connection to your Docker-based container platform for container management
          </p>
        </div>
        <div className="absolute right-0 top-0 -z-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -z-0 h-48 w-48 rounded-full bg-primary/5 blur-2xl" />
      </div>

      {/* Configuration Status Card */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Connection Status
              </span>
              {getConnectionStatusBadge()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Configuration Source:</span>
                <span className="font-medium capitalize">{config.source || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Connection Test:</span>
                <span className="font-medium">{formatLastTest(config.lastConnectionTest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API URL:</span>
                <span className="font-mono text-xs truncate max-w-xs" title={config.apiUrl}>
                  {config.apiUrl || 'Not configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Key:</span>
                <span className="font-medium">
                  {config.hasApiKey ? '••••••••' : 'Not set'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {testResult.status && (
            <Alert variant={testResult.status === 'success' ? 'default' : 'destructive'}>
              {testResult.status === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiUrl">Docker API URL *</Label>
            <Input
              id="apiUrl"
              type="url"
              value={formData.apiUrl}
              onChange={(e) => handleInputChange('apiUrl', e.target.value)}
              placeholder="http://localhost:2375 or unix:///var/run/docker.sock"
              disabled={isLoading || saveConfigMutation.isPending}
            />
            {formErrors.apiUrl && (
              <p className="text-sm text-destructive">{formErrors.apiUrl}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The URL to your Docker API endpoint. For local development, use http://localhost:2375 or the Docker socket path.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key {!config?.hasApiKey && '*'}</Label>
            <Input
              id="apiKey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => handleInputChange('apiKey', e.target.value)}
              placeholder={config?.hasApiKey ? 'Enter new API key to update' : 'Enter API key'}
              disabled={isLoading || saveConfigMutation.isPending}
            />
            {formErrors.apiKey && (
              <p className="text-sm text-destructive">{formErrors.apiKey}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {config?.hasApiKey 
                ? 'Leave blank to keep the existing API key. Enter a new key to update it.' 
                : 'API key for Docker API authentication. Optional for socket connections.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleSaveConfig}
              disabled={!hasChanges || isLoading || saveConfigMutation.isPending || testConnectionMutation.isPending}
              className="flex-1"
            >
              {saveConfigMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isLoading || saveConfigMutation.isPending || testConnectionMutation.isPending}
              className="flex-1"
            >
              {testConnectionMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">About Container Platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The Container Platform uses Docker to provide isolated container environments for your users.
            Each tenant gets their own network namespace and resource quotas for enhanced security and performance.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Rootless Docker containers with strict security policies</li>
            <li>Per-tenant network isolation and resource limits</li>
            <li>Automatic TLS certificate management</li>
            <li>Support for Docker images, Git deployments, and custom Dockerfiles</li>
            <li>Built-in database templates (PostgreSQL, MySQL, MongoDB, Redis)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
