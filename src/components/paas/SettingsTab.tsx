import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Settings } from 'lucide-react'

interface Props {
  applicationId: string
  application: any
  onUpdate: () => void
}

export const SettingsTab: React.FC<Props> = ({ applicationId, application, onUpdate }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Application Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          Settings management coming soon
        </div>
      </CardContent>
    </Card>
  )
}
