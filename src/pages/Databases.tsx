import React, { useEffect, useState, useCallback } from 'react'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Database, Loader2, AlertCircle, CheckCircle, Trash2, Eye, EyeOff } from 'lucide-react'
import { CreateDatabaseModal } from '@/components/paas/CreateDatabaseModal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface DatabaseInstance {
  id: string
  name: string
  db_type: 'mysql' | 'postgresql' | 'redis' | 'mongodb'
  version: string
  status: 'pending' | 'running' | 'stopped' | 'failed'
  host?: string
  port?: number
  username?: string
  password?: string
  database_name?: string
  created_at: string
}

const statusColors: Record<DatabaseInstance['status'], string> = {
  pending: 'bg-gray-500',
  running: 'bg-green-500',
  stopped: 'bg-gray-400',
  failed: 'bg-red-500',
}

const dbTypeIcons: Record<DatabaseInstance['db_type'], string> = {
  mysql: '🐬',
  postgresql: '🐘',
  redis: '🔴',
  mongodb: '🍃',
}

const Databases: React.FC = () => {
  const [databases, setDatabases] = useState<DatabaseInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dbToDelete, setDbToDelete] = useState<DatabaseInstance | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
  const [selectedDb, setSelectedDb] = useState<DatabaseInstance | null>(null)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  const loadDatabases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl('/paas/databases'), {
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setDatabases(data.data || [])
      } else {
        setError(data.error || 'Failed to load databases')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load databases')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void loadDatabases()
  }, [loadDatabases])

  const handleCreateSuccess = useCallback(() => {
    setCreateModalOpen(false)
    void loadDatabases()
  }, [loadDatabases])

  const handleDeleteClick = useCallback((db: DatabaseInstance) => {
    setDbToDelete(db)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!dbToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/databases/${dbToDelete.id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        void loadDatabases()
        setDeleteDialogOpen(false)
      } else {
        alert(data.error || 'Failed to delete database')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete database')
    } finally {
      setDeleting(false)
      setDbToDelete(null)
    }
  }, [dbToDelete, authHeaders, loadDatabases])

  const handleShowConnection = useCallback((db: DatabaseInstance) => {
    setSelectedDb(db)
    setConnectionDialogOpen(true)
  }, [])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const getConnectionString = (db: DatabaseInstance) => {
    if (!db.host || !db.port) return 'Connection details not available yet'
    
    switch (db.db_type) {
      case 'mysql':
        return `mysql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database_name}`
      case 'postgresql':
        return `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database_name}`
      case 'redis':
        return `redis://:${db.password}@${db.host}:${db.port}`
      case 'mongodb':
        return `mongodb://${db.username}:${db.password}@${db.host}:${db.port}/${db.database_name}`
      default:
        return ''
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Databases</h1>
          <p className="text-muted-foreground mt-2">
            Provision and manage your database instances
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create Database
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="inline h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`skeleton-${idx}`}>
              <CardHeader>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : databases.length === 0 ? (
        <Card className="p-12 text-center">
          <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No databases yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first database to get started
          </p>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Database
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {databases.map((db) => (
            <Card key={db.id} className="hover:shadow-lg transition-shadow group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate flex items-center gap-2">
                      <span className="text-2xl">{dbTypeIcons[db.db_type]}</span>
                      {db.name}
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <Badge variant="secondary" className={`${statusColors[db.status]} text-white`}>
                        {db.status === 'running' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {db.status}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteClick(db)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium capitalize">{db.db_type} {db.version}</span>
                </div>
                {db.host && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Host:</span>{' '}
                    <span className="font-mono text-xs">{db.host}:{db.port}</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Created {formatDate(db.created_at)}
                </div>
                {db.status === 'running' && db.host && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleShowConnection(db)}
                  >
                    View Connection Details
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateDatabaseModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Database</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{dbToDelete?.name}</strong>? This action
              cannot be undone. All data will be permanently lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Connection Details - {selectedDb?.name}</DialogTitle>
          </DialogHeader>
          {selectedDb && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Host</Label>
                  <Input value={selectedDb.host || ''} readOnly />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input value={selectedDb.port?.toString() || ''} readOnly />
                </div>
              </div>
              <div>
                <Label>Username</Label>
                <Input value={selectedDb.username || ''} readOnly />
              </div>
              <div>
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPasswords[selectedDb.id] ? 'text' : 'password'}
                    value={selectedDb.password || ''}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setShowPasswords((prev) => ({ ...prev, [selectedDb.id]: !prev[selectedDb.id] }))
                    }
                  >
                    {showPasswords[selectedDb.id] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {selectedDb.database_name && (
                <div>
                  <Label>Database Name</Label>
                  <Input value={selectedDb.database_name} readOnly />
                </div>
              )}
              <div>
                <Label>Connection String</Label>
                <Input
                  value={showPasswords[selectedDb.id] ? getConnectionString(selectedDb) : getConnectionString(selectedDb).replace(selectedDb.password || '', '••••••••')}
                  readOnly
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Databases
