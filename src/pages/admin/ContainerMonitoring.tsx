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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Container Monitoring</h1>
        <p className="text-muted-foreground">
          Platform-wide container deployment statistics and monitoring
        </p>
      </div>

      {/* Platform Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : overview?.totalSubscriptions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overviewLoading ? '...' : overview?.activeSubscriptions || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : overview?.totalProjects || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : overview?.totalServices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Running containers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resource Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">
                  {overviewLoading ? '...' : overview?.totalResourceUsage?.cpuCores || 0}
                </span> CPU cores
              </div>
              <div className="text-sm">
                <span className="font-medium">
                  {overviewLoading ? '...' : overview?.totalResourceUsage?.memoryGb || 0}
                </span> GB RAM
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown - Hidden for now since we don't have this data */}

      {/* Active Subscriptions */}
      <Card>
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
      <Card>
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