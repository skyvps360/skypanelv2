import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Database } from 'lucide-react'

interface Props {
  applicationId: string
}

export const DatabasesTab: React.FC<Props> = ({ applicationId }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Linked Databases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          Database management coming soon
        </div>
      </CardContent>
    </Card>
  )
}
