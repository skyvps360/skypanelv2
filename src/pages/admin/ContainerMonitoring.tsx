import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Server, Database, Users, TrendingUp, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { containerService } from '@/services/containerService'
import type { ContainerSubscription, ContainerService as ContainerServiceType } from '@/types/containers'

interface PlatformStats {
  totalSubscriptions: number
  activeSubscriptions: number
  totalProjects: number
  totalServices: number
  totalResourceUsage: {
    cpuCores: number
    memoryGb: number
    storageGb: number
    containerCount: number
  }
  subscriptionsByPlan: Array<{
    planName: string
    count: number
    revenue: number
  }>
}

interface OrganizationDetail {
  id: string
  name: string
  subscription: ContainerSubscription
  projects: Array<{
    id: string
    projectName: string
    serviceCount: number
    services: ContainerServiceType[]
  }>
  resourceUsage: {
    cpuCores: number
    memoryGb: number
    storageGb: number
    containerCount: number
  }
}

export default function ContainerMonitoring() {
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  const { data: overviewResponse, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin', 'container-overview'],
    queryFn: containerService.getAdminOverview,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const overview = overviewResponse?.success ? {
    totalSubscriptions: overviewResponse.statistics?.totalSubscriptions || 0,
    activeSubscriptions: overviewResponse.statistics?.totalSubscriptions || 0,
    totalProjects: overviewResponse.statistics?.totalProjects || 0,
    totalServices: overviewResponse.statistics?.totalServices || 0,
    totalResourceUsage: {
      cpuCores: overviewResponse.resourceUsage?.totalCpuCores || 0,
      memoryGb: overviewResponse.resourceUsage?.totalMemoryGb || 0,
      storageGb: overviewResponse.resourceUsage?.totalStorageGb || 0,
      containerCount: overviewResponse.resourceUsage?.totalContainers || 0
    },
    subscriptionsByPlan: []
  } : null

  const { data: subscriptionsResponse, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['admin', 'container-subscriptions'],
    queryFn: containerService.getAdminSubscriptions
  })

  const subscriptions = subscriptionsResponse?.subscriptions || []

  const { data: servicesResponse, isLoading: servicesLoading } = useQuery({
    queryKey: ['admin', 'container-services'],
    queryFn: containerService.getAdminServices
  })

  const allServices = servicesResponse?.services || []

  const { data: organizationDetailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'organization-detail', selectedOrganization],
    queryFn: () => containerService.getOrganizationDetail(selectedOrganization!),
    enabled: !!selectedOrganization
  })

  const organizationDetail = organizationDetailResponse?.organization

  const handleViewOrganization = (organizationId: string) => {
    setSelectedOrganization(organizationId)
    setIsDetailDialogOpen(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'suspended':
        return 'destructive'
      case 'cancelled':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'default'
      case 'stopped':
        return 'secondary'
      case 'error':
        return 'destructive'
      case 'deploying':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <div>
      {/* Clean Hero Section - matching admin dashboard style */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-3">
            Container Platform
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Container Monitoring
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Platform-wide container deployment statistics and monitoring
          </p>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Activity className="absolute right-10 top-10 h-32 w-32 rotate-12" />
          <Server className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
        </div>
      </div>

      {/* Platform Statistics - matching admin dashboard style */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Subscriptions</p>
                <p className="text-3xl font-bold tracking-tight">
                  {overviewLoading ? '...' : overview?.totalSubscriptions || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overviewLoading ? '...' : overview?.activeSubscriptions || 0} active
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-bold tracking-tight">
                  {overviewLoading ? '...' : overview?.totalProjects || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Across all organizations
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Server className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Services</p>
                <p className="text-3xl font-bold tracking-tight">
                  {overviewLoading ? '...' : overview?.totalServices || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Running containers
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Database className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Resource Usage</p>
                <p className="text-3xl font-bold tracking-tight">
                  {overviewLoading ? '...' : overview?.totalResourceUsage?.cpuCores || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  CPU cores • {overviewLoading ? '...' : overview?.totalResourceUsage?.memoryGb || 0} GB RAM
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <Activity className="h-6 w-6 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown - Hidden for now since we don't have this data */}

      {/* Active Subscriptions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Monthly Cost</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="font-medium">
                        {subscription.organizationName || 'Unknown Organization'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {subscription.plan?.name || 'Unknown Plan'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(subscription.status)}>
                        {subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(subscription.plan?.priceMonthly || 0)}
                    </TableCell>
                    <TableCell>
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewOrganization(subscription.organizationId)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No active subscriptions found.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All Services */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All Container Services</CardTitle>
        </CardHeader>
        <CardContent>
          {servicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resources</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="font-medium">{service.serviceName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{service.projectName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {service.organizationName || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{service.serviceType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getServiceStatusColor(service.status)}>
                        {service.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {service.cpuLimit && (
                          <div>{service.cpuLimit} CPU</div>
                        )}
                        {service.memoryLimitGb && (
                          <div>{service.memoryLimitGb} GB RAM</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(service.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {allServices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        No container services found.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Organization Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organization Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : organizationDetail ? (
            <div className="space-y-6">
              {/* Organization Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Organization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Name:</span> {organizationDetail.name}
                      </div>
                      <div>
                        <span className="font-medium">Plan:</span> {organizationDetail.subscription.plan?.name}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>{' '}
                        <Badge variant={getStatusColor(organizationDetail.subscription.status)}>
                          {organizationDetail.subscription.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resource Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>CPU Cores</span>
                          <span>
                            {organizationDetail.resourceUsage.cpuCores} / {organizationDetail.subscription.plan?.maxCpuCores}
                          </span>
                        </div>
                        <Progress
                          value={(organizationDetail.resourceUsage.cpuCores / (organizationDetail.subscription.plan?.maxCpuCores || 1)) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Memory (GB)</span>
                          <span>
                            {organizationDetail.resourceUsage.memoryGb} / {organizationDetail.subscription.plan?.maxMemoryGb}
                          </span>
                        </div>
                        <Progress
                          value={(organizationDetail.resourceUsage.memoryGb / (organizationDetail.subscription.plan?.maxMemoryGb || 1)) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Containers</span>
                          <span>
                            {organizationDetail.resourceUsage.containerCount} / {organizationDetail.subscription.plan?.maxContainers}
                          </span>
                        </div>
                        <Progress
                          value={(organizationDetail.resourceUsage.containerCount / (organizationDetail.subscription.plan?.maxContainers || 1)) * 100}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Projects and Services */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Projects and Services</CardTitle>
                </CardHeader>
                <CardContent>
                  {organizationDetail.projects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No projects found for this organization.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {organizationDetail.projects.map((project) => (
                        <div key={project.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{project.projectName}</h4>
                            <Badge variant="outline">
                              {project.serviceCount} service{project.serviceCount !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {project.services.length > 0 && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Service</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Resources</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {project.services.map((service) => (
                                  <TableRow key={service.id}>
                                    <TableCell className="font-medium">
                                      {service.serviceName}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{service.serviceType}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={getServiceStatusColor(service.status)}>
                                        {service.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        {service.cpuLimit && `${service.cpuLimit} CPU`}
                                        {service.cpuLimit && service.memoryLimitGb && ', '}
                                        {service.memoryLimitGb && `${service.memoryLimitGb} GB RAM`}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Organization details not found.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}