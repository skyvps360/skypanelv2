/**
 * Cost Estimator Component
 * Provides real-time cost estimates for container service configurations
 */
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { DollarSign } from 'lucide-react';

interface CostEstimate {
  hourly: number;
  daily: number;
  monthly: number;
  breakdown: {
    cpu: { hourly: number; daily: number; monthly: number };
    memory: { hourly: number; daily: number; monthly: number };
    storage: { hourly: number; daily: number; monthly: number };
    network: { hourly: number; daily: number; monthly: number };
    build: { hourly: number; daily: number; monthly: number };
  };
}

interface CostEstimatorProps {
  initialCpuCores?: number;
  initialMemoryMb?: number;
  initialDiskGb?: number;
  onEstimateChange?: (estimate: CostEstimate) => void;
}

export function CostEstimator({
  initialCpuCores = 1,
  initialMemoryMb = 512,
  initialDiskGb = 10,
  onEstimateChange,
}: CostEstimatorProps) {
  const [cpuCores, setCpuCores] = useState(initialCpuCores);
  const [memoryMb, setMemoryMb] = useState(initialMemoryMb);
  const [diskGb, setDiskGb] = useState(initialDiskGb);
  const [buildMinutesPerDay, setBuildMinutesPerDay] = useState(0);
  const [networkGbPerDay, setNetworkGbPerDay] = useState(0);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEstimate();
  }, [cpuCores, memoryMb, diskGb, buildMinutesPerDay, networkGbPerDay]);

  const fetchEstimate = async () => {
    try {
      setLoading(true);
      const response = await api.post('/containers/billing/estimate', {
        cpuCores,
        memoryMb,
        diskGb,
        estimatedBuildMinutesPerDay: buildMinutesPerDay,
        estimatedNetworkGbPerDay: networkGbPerDay,
      });

      const newEstimate = response.data.estimate;
      setEstimate(newEstimate);
      
      if (onEstimateChange) {
        onEstimateChange(newEstimate);
      }
    } catch (error) {
      console.error('Error fetching cost estimate:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Estimate
        </CardTitle>
        <CardDescription>
          Adjust resources to see estimated costs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resource Configuration */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU Cores: {cpuCores}</Label>
            <Input
              id="cpu"
              type="range"
              min={0.5}
              max={16}
              step={0.5}
              value={cpuCores}
              onChange={(e) => setCpuCores(parseFloat(e.target.value))}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memory">Memory: {memoryMb} MB</Label>
            <Input
              id="memory"
              type="range"
              min={256}
              max={32768}
              step={256}
              value={memoryMb}
              onChange={(e) => setMemoryMb(parseInt(e.target.value))}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="disk">Storage: {diskGb} GB</Label>
            <Input
              id="disk"
              type="range"
              min={1}
              max={500}
              step={1}
              value={diskGb}
              onChange={(e) => setDiskGb(parseInt(e.target.value))}
              className="cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="build">Build Minutes per Day (optional)</Label>
            <Input
              id="build"
              type="number"
              min={0}
              value={buildMinutesPerDay}
              onChange={(e) => setBuildMinutesPerDay(parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="network">Network GB per Day (optional)</Label>
            <Input
              id="network"
              type="number"
              min={0}
              step={0.1}
              value={networkGbPerDay}
              onChange={(e) => setNetworkGbPerDay(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </div>

        <Separator />

        {/* Cost Summary */}
        {estimate && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatCurrency(estimate.hourly)}</div>
                <div className="text-xs text-muted-foreground">per hour</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatCurrency(estimate.daily)}</div>
                <div className="text-xs text-muted-foreground">per day</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatCurrency(estimate.monthly)}</div>
                <div className="text-xs text-muted-foreground">per month</div>
              </div>
            </div>

            <Separator />

            {/* Cost Breakdown */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Cost Breakdown (Monthly)</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU</span>
                  <span>{formatCurrency(estimate.breakdown.cpu.monthly)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory</span>
                  <span>{formatCurrency(estimate.breakdown.memory.monthly)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage</span>
                  <span>{formatCurrency(estimate.breakdown.storage.monthly)}</span>
                </div>
                {estimate.breakdown.network.monthly > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network</span>
                    <span>{formatCurrency(estimate.breakdown.network.monthly)}</span>
                  </div>
                )}
                {estimate.breakdown.build.monthly > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Build Time</span>
                    <span>{formatCurrency(estimate.breakdown.build.monthly)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center text-sm text-muted-foreground">
            Calculating costs...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
