/**
 * Environment Variable Manager Component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';

interface EnvVar {
  id: string;
  key: string;
  is_system: boolean;
  created_at: string;
}

interface EnvVarManagerProps {
  appId: string;
}

export const EnvVarManager: React.FC<EnvVarManagerProps> = ({ appId }) => {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEnvVars = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/paas/apps/${appId}/env`);
      setEnvVars(data.env_vars || []);
    } catch (error) {
      toast.error('Failed to load environment variables');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadEnvVars();
  }, [loadEnvVars]);

  const handleAdd = async () => {
    if (!newKey || !newValue) {
      toast.error('Please enter both key and value');
      return;
    }

    try {
      await apiClient.put(`/paas/apps/${appId}/env`, {
        vars: { [newKey]: newValue },
      });
      toast.success('Environment variable added');
      setNewKey('');
      setNewValue('');
      loadEnvVars();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add variable');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete ${key}?`)) return;

    try {
      await apiClient.delete(`/paas/apps/${appId}/env/${key}`);
      toast.success('Environment variable deleted');
      loadEnvVars();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete variable');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment Variables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-semibold">Add New Variable</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Key</Label>
              <Input
                placeholder="DATABASE_URL"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
            <div>
              <Label>Value</Label>
              <Input
                type="password"
                placeholder="postgresql://..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Variable
          </Button>
        </div>

        {/* Existing Variables */}
        <div className="space-y-2">
          <h4 className="font-semibold">Current Variables</h4>
          {loading ? (
            <p>Loading...</p>
          ) : envVars.length === 0 ? (
            <p className="text-muted-foreground">No environment variables set</p>
          ) : (
            envVars.map((envVar) => (
              <div
                key={envVar.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono">{envVar.key}</span>
                  {envVar.is_system && (
                    <span className="text-xs text-muted-foreground">(system)</span>
                  )}
                </div>
                {!envVar.is_system && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(envVar.key)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
