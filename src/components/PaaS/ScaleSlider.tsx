/**
 * Scale Slider Component
 */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { apiClient } from '@/lib/api';

interface ScaleSliderProps {
  appId: string;
  currentReplicas: number;
  maxReplicas?: number;
  hourlyRate?: number;
  onUpdate: () => void;
}

export const ScaleSlider: React.FC<ScaleSliderProps> = ({
  appId,
  currentReplicas,
  maxReplicas,
  hourlyRate,
  onUpdate,
}) => {
  const [replicas, setReplicas] = useState(currentReplicas);
  const [scaling, setScaling] = useState(false);
  const planLimit = typeof maxReplicas === 'number' ? maxReplicas : 20;
  const sliderMax = Math.max(planLimit, currentReplicas);
  const rate = Number(hourlyRate ?? 0);
  const estimatedCost = rate > 0 ? (rate * replicas).toFixed(4) : null;

  useEffect(() => {
    setReplicas(currentReplicas);
  }, [currentReplicas]);

  const handleScale = async () => {
    if (replicas === currentReplicas) return;
    setScaling(true);
    try {
      const data = await apiClient.post(`/paas/apps/${appId}/scale`, { replicas });
      const costSuffix =
        typeof data?.hourlyCostAfter === 'number'
          ? ` • ~$${Number(data.hourlyCostAfter).toFixed(4)}/hr`
          : estimatedCost
            ? ` • ~$${estimatedCost}/hr`
            : '';
      toast.success(`Scaled to ${replicas} replica${replicas !== 1 ? 's' : ''}${costSuffix}`);
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
            max={sliderMax}
            step={1}
            className="w-full"
          />
        </div>
        <span className="font-semibold min-w-[3rem] text-right">{replicas}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Plan limit: {planLimit} replicas
        {estimatedCost ? ` • Estimated $${estimatedCost}/hr` : ''}
      </p>
      {replicas !== currentReplicas && (
        <Button onClick={handleScale} disabled={scaling} size="sm">
          {scaling ? 'Scaling...' : `Scale to ${replicas}`}
        </Button>
      )}
    </div>
  );
};
