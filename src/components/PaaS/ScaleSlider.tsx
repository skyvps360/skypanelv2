/**
 * Scale Slider Component
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { apiClient } from '@/lib/api';

interface ScaleSliderProps {
  appId: string;
  currentReplicas: number;
  onUpdate: () => void;
}

export const ScaleSlider: React.FC<ScaleSliderProps> = ({ appId, currentReplicas, onUpdate }) => {
  const [replicas, setReplicas] = useState(currentReplicas);
  const [scaling, setScaling] = useState(false);

  const handleScale = async () => {
    setScaling(true);
    try {
      await apiClient.post(`/paas/apps/${appId}/scale`, { replicas });
      toast.success(`Scaled to ${replicas} replica${replicas !== 1 ? 's' : ''}`);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to scale');
    } finally {
      setScaling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Activity className="w-5 h-5" />
        <div className="flex-1">
          <Slider
            value={[replicas]}
            onValueChange={(value) => setReplicas(value[0])}
            min={0}
            max={20}
            step={1}
            className="w-full"
          />
        </div>
        <span className="font-semibold min-w-[3rem] text-right">{replicas}</span>
      </div>
      {replicas !== currentReplicas && (
        <Button onClick={handleScale} disabled={scaling} size="sm">
          {scaling ? 'Scaling...' : `Scale to ${replicas}`}
        </Button>
      )}
    </div>
  );
};
