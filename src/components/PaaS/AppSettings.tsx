/**
 * App Settings Component
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';

interface AppSettingsProps {
  app: any;
  onUpdate: () => void;
}

export const AppSettings: React.FC<AppSettingsProps> = ({ app, onUpdate }) => {
  const [name, setName] = useState(app.name);
  const [gitUrl, setGitUrl] = useState(app.git_url || '');
  const [gitBranch, setGitBranch] = useState(app.git_branch);
  const [buildpack, setBuildpack] = useState(app.buildpack || '');
  const [saving, setSaving] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/paas/apps/${app.id}`, {
        name,
        git_url: gitUrl,
        git_branch: gitBranch,
        buildpack: buildpack || undefined,
      });
      toast.success('Settings saved');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const { removed = 0 } = await apiClient.post(`/paas/apps/${app.id}/cache/clear`);
      toast.success(
        removed > 0 ? `Cleared ${removed} cache entr${removed === 1 ? 'y' : 'ies'}` : 'Build cache already empty'
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear build cache');
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Application Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <Label>Git Repository URL</Label>
          <Input
            type="url"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="https://github.com/username/repo"
          />
        </div>

        <div>
          <Label>Git Branch</Label>
          <Input value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} />
        </div>

        <div>
          <Label>Buildpack (optional)</Label>
          <Input
            value={buildpack}
            onChange={(e) => setBuildpack(e.target.value)}
            placeholder="Auto-detect"
          />
        </div>

        <div className="space-y-2">
          <div>
            <Label>Build Cache</Label>
            <p className="text-sm text-muted-foreground">
              Clear cached dependencies if you suspect corrupted build artifacts.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearCache}
            disabled={clearingCache}
          >
            {clearingCache ? 'Clearing cache...' : 'Clear Build Cache'}
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
