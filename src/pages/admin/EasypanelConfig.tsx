import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, TestTube, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { containerService } from '@/services/containerService'
import type { EasypanelConfigRequest } from '@/types/containers'

interface EasypanelConfig {
  id?: string
  apiUrl: string
  apiKey?: string
  hasApiKey?: boolean
  active?: boolean
  lastConnectionTest?: string
  connectionStatus?: 'success' | 'failed' | 'pending' | 'connected' | 'env-config'
  source?: 'db' | 'env' | 'none'
}

interface ConfigFormData {
  apiUrl: string
  apiKey: string
}

const initialFormData: ConfigFormData = {
  apiUrl: '',
  apiKey: ''
}

export default function EasypanelConfig() {
  const [formData, setFormData] = useState<ConfigFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Partial<ConfigFormData>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error' | null
    message: string
  }>({ status: null, message: '' })

  const queryClient = useQueryClient()

  const { data: configResponse, isLoading } = useQuery({
    queryKey: ['admin', 'easypanel-config'],
    queryFn: containerService.getEasypanelConfig
  })

  const config = configResponse?.config

  const saveConfigMutation = useMutation({
    mutationFn: containerService.updateEasypanelConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'easypanel-config'] })
      setHasChanges(false)
      // Clear the API key field after successful save for security
      setFormData(prev => ({ ...prev, apiKey: '' }))
      toast.success('Easypanel configuration saved successfully')
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.response?.data?.error?.message || 'Failed to save configuration'
      toast.error(errorMessage)
    }
  })

  const testConnectionMutation = useMutation({
    mutationFn: containerService.testEasypanelConnection,
    onSuccess: async (result) => {
      // Invalidate and refetch to get updated connection status
      await queryClient.refetchQueries({ queryKey: ['admin', 'easypanel-config'] })
      setTestResult({
        status: 'success',
        message: result.message || 'Connection test successful'
      })
      toast.success('Easypanel connection test successful')
    },
    onError: async (error: any) => {
      // Still refetch to get updated status even on error
      await queryClient.refetchQueries({ queryKey: ['admin', 'easypanel-config'] })
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
        apiUrl: config.apiUrl || '',
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

    const configData: EasypanelConfigRequest = {
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
    
    const configData: EasypanelConfigRequest = {
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
    if (!config?.connectionStatus) return null

    // Normalize the status values from backend
    const normalizedStatus = config.connectionStatus === 'connected' ? 'success' : config.connectionStatus

    switch (normalizedStatus) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case 'env-config':
        return (
          <Badge variant="secondary">
            <CheckCircle className="h-3 w-3 mr-1" />
            Environment Config
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
      <div>
        <h1 className="text-3xl font-bold">Easypanel Configuration</h1>
        <p className="text-muted-foreground">
          Configure connection to your Easypanel instance for container management
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="apiUrl">Easypanel API URL</Label>
                    <Input
                      id="apiUrl"
                      type="url"
                      value={formData.apiUrl}
                      onChange={(e) => handleInputChange('apiUrl', e.target.value)}
                      placeholder="https://easypanel.example.com"
                    />
                    {formErrors.apiUrl && (
                      <p className="text-sm text-red-500">{formErrors.apiUrl}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      The base URL of your Easypanel instance
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => handleInputChange('apiKey', e.target.value)}
                      placeholder={config?.hasApiKey ? "Enter new API key (leave blank to keep current)" : "Enter your Easypanel API key"}
                    />
                    {formErrors.apiKey && (
                      <p className="text-sm text-red-500">{formErrors.apiKey}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {config?.hasApiKey 
                        ? "API key with permissions to manage projects and services (configured)"
                        : "API key with permissions to manage projects and services"
                      }
                    </p>
                  </div>

                  {/* Test Result Alert */}
                  {testResult.status && (
                    <Alert className={testResult.status === 'success' ? 'border-green-500' : 'border-red-500'}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {testResult.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex space-x-2 pt-4">
                    <Button
                      onClick={handleTestConnection}
                      variant="outline"
                      disabled={testConnectionMutation.isPending || !formData.apiUrl || (!formData.apiKey && !config?.hasApiKey)}
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                    </Button>
                    
                    <Button
                      onClick={handleSaveConfig}
                      disabled={saveConfigMutation.isPending || !hasChanges}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Current Status</Label>
                    <div>
                      {getConnectionStatusBadge() || (
                        <Badge variant="outline">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Not Configured
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Last Test</Label>
                    <p className="text-sm text-muted-foreground">
                      {formatLastTest(config?.lastConnectionTest)}
                    </p>
                  </div>

                  {config?.apiUrl && (
                    <div className="space-y-2">
                      <Label>Configured URL</Label>
                      <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                        {config.apiUrl}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Configuration Status</Label>
                    <Badge
                      variant={config?.connectionStatus === 'success' || config?.connectionStatus === 'connected' || config?.connectionStatus === 'env-config' ? 'default' : 'secondary'}
                    >
                      {config?.connectionStatus === 'env-config'
                        ? 'Provided via environment'
                        : config?.connectionStatus === 'success' || config?.connectionStatus === 'connected'
                          ? 'Active'
                          : 'Inactive'}
                    </Badge>
                    {config?.source === 'env' && (
                      <p className="text-xs text-muted-foreground">
                        This connection uses credentials from server environment variables.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Setup Help</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p className="font-medium">To configure Easypanel:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Log into your Easypanel instance</li>
                  <li>Navigate to Settings → User → Your Admin User → API Keys</li>
                  <li>Copy The API Key And Paste It Above</li>
                  <li>Enter Easypanel URL (e.g., https://panel.example.com)</li>
                  <li>Test the connection before saving</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}