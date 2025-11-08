import React, { useEffect, useState, useCallback } from 'react'
import { buildApiUrl } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Database, Plus, Trash2, Link as LinkIcon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DatabaseInstance {
  id: string
  name: string
  db_type: string
  version: string
  status: string
  host?: string
  port?: number
}

interface LinkedDatabase {
  id: string
  database_id: string
  env_var_prefix: string
  database?: DatabaseInstance
}

interface Props {
  applicationId: string
}

export const DatabasesTab: React.FC<Props> = ({ applicationId }) => {
  const [linkedDatabases, setLinkedDatabases] = useState<LinkedDatabase[]>([])
  const [availableDatabases, setAvailableDatabases] = useState<DatabaseInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDb, setSelectedDb] = useState('')
  const [linking, setLinking] = useState(false)

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [linkedRes, allDbsRes] = await Promise.all([
        fetch(buildApiUrl(`/paas/applications/${applicationId}/databases`), {
          headers: authHeaders(),
        }),
        fetch(buildApiUrl('/paas/databases'), {
          headers: authHeaders(),
        }),
      ])

      const linkedData = await linkedRes.json()
      const allDbsData = await allDbsRes.json()

      if (linkedData.success) {
        setLinkedDatabases(linkedData.data || [])
      }
      if (allDbsData.success) {
        setAvailableDatabases(allDbsData.data || [])
      }
    } catch (err) {
      console.error('Failed to load databases:', err)
    } finally {
      setLoading(false)
    }
  }, [applicationId, authHeaders])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleLink = useCallback(async () => {
    if (!selectedDb) return
    setLinking(true)
    try {
      const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/databases/${selectedDb}`), {
        method: 'POST',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (data.success) {
        setSelectedDb('')
        void loadData()
      } else {
        alert(data.error || 'Failed to link database')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to link database')
    } finally {
      setLinking(false)
    }
  }, [selectedDb, applicationId, authHeaders, loadData])

  const handleUnlink = useCallback(
    async (dbId: string) => {
      try {
        const res = await fetch(buildApiUrl(`/paas/applications/${applicationId}/databases/${dbId}`), {
          method: 'DELETE',
          headers: authHeaders(),
        })
        const data = await res.json()
        if (data.success) {
          void loadData()
        } else {
          alert(data.error || 'Failed to unlink database')
        }
      } catch (err: any) {
        alert(err?.message || 'Failed to unlink database')
      }
    },
    [applicationId, authHeaders, loadData]
  )

  const linkedDbIds = new Set(linkedDatabases.map((ld) => ld.database_id))
  const unlinkedDatabases = availableDatabases.filter((db) => !linkedDbIds.has(db.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Linked Databases
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {linkedDatabases.length > 0 && (
              <div className="space-y-2">
                {linkedDatabases.map((link) => {
                  const db = link.database || availableDatabases.find((d) => d.id === link.database_id)
                  if (!db) return null
                  return (
                    <div key={link.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex-1">
                        <div className="font-medium">{db.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {db.db_type} {db.version}
                          {db.host && <span> • {db.host}:{db.port}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Environment prefix: {link.env_var_prefix}_URL
                        </div>
                      </div>
                      <Badge variant="secondary" className="mr-2">
                        {db.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUnlink(db.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {unlinkedDatabases.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Link Database</h3>
                <div className="flex gap-2">
                  <Select value={selectedDb} onValueChange={setSelectedDb}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select database..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unlinkedDatabases.map((db) => (
                        <SelectItem key={db.id} value={db.id}>
                          {db.name} ({db.db_type} {db.version})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleLink} disabled={!selectedDb || linking}>
                    {linking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {linkedDatabases.length === 0 && unlinkedDatabases.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No databases available. Create a database first.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
