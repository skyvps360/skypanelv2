import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

interface StatsGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  description,
  icon,
  trend
}) => {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex items-center justify-between gap-6 p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${
                trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
};

export const StatsGrid: React.FC<StatsGridProps> = ({
  stats,
  columns = 4,
  className = ''
}) => {
  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 xl:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4'
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]} ${className}`}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};