/**
 * PaaS Settings Admin Component
 * Configure PaaS system settings
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';

export const PaaSSettingsAdmin: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiClient.get('/admin/paas/settings');
      const settingsMap: Record<string, any> = {};
      (data.settings || []).forEach((setting: any) => {
        settingsMap[setting.key] = setting.value_encrypted;
      });
      setSettings(settingsMap);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/admin/paas/settings', { settings });
      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">PaaS Settings</h2>
        <p className="text-muted-foreground">Configure your Platform-as-a-Service</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Basic PaaS configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Domain</Label>
            <Input
              value={settings.default_domain || ''}
              onChange={(e) => updateSetting('default_domain', e.target.value)}
              placeholder="apps.yourdomain.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Apps will be accessible at subdomain.apps.yourdomain.com
            </p>
          </div>

          <div>
            <Label>Max Apps Per Organization</Label>
            <Input
              type="number"
              value={settings.max_apps_per_org || 0}
              onChange={(e) => updateSetting('max_apps_per_org', parseInt(e.target.value))}
              placeholder="0 = unlimited"
            />
          </div>

          <div>
            <Label>Max Deployments Per Hour</Label>
            <Input
              type="number"
              value={settings.max_deployments_per_hour || 5}
              onChange={(e) => updateSetting('max_deployments_per_hour', parseInt(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage Configuration</CardTitle>
          <CardDescription>Configure where build artifacts are stored</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Storage Type</Label>
            <Select
              value={settings.storage_type || 'local'}
              onValueChange={(value) => updateSetting('storage_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Filesystem</SelectItem>
                <SelectItem value="s3">S3-Compatible Storage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.storage_type === 's3' && (
            <>
              <div>
                <Label>S3 Bucket</Label>
                <Input
                  value={settings.s3_bucket || ''}
                  onChange={(e) => updateSetting('s3_bucket', e.target.value)}
                  placeholder="my-paas-builds"
                />
              </div>
              <div>
                <Label>S3 Region</Label>
                <Input
                  value={settings.s3_region || ''}
                  onChange={(e) => updateSetting('s3_region', e.target.value)}
                  placeholder="us-east-1"
                />
              </div>
              <div>
                <Label>S3 Access Key</Label>
                <Input
                  value={settings.s3_access_key || ''}
                  onChange={(e) => updateSetting('s3_access_key', e.target.value)}
                  placeholder="AKIA..."
                />
              </div>
              <div>
                <Label>S3 Secret Key</Label>
                <Input
                  type="password"
                  value={settings.s3_secret_key || ''}
                  onChange={(e) => updateSetting('s3_secret_key', e.target.value)}
                />
              </div>
              <div>
                <Label>S3 Endpoint (optional, for MinIO/B2)</Label>
                <Input
                  value={settings.s3_endpoint || ''}
                  onChange={(e) => updateSetting('s3_endpoint', e.target.value)}
                  placeholder="https://s3.us-east-1.amazonaws.com"
                />
              </div>
            </>
          )}

          {settings.storage_type === 'local' && (
            <div>
              <Label>Local Storage Path</Label>
              <Input
                value={settings.local_storage_path || '/var/paas/storage'}
                onChange={(e) => updateSetting('local_storage_path', e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logging Configuration</CardTitle>
          <CardDescription>Configure log aggregation and retention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Loki Endpoint</Label>
            <Input
              value={settings.loki_endpoint || 'http://localhost:3100'}
              onChange={(e) => updateSetting('loki_endpoint', e.target.value)}
            />
          </div>
          <div>
            <Label>Log Retention (days)</Label>
            <Input
              type="number"
              value={settings.loki_retention_days || 7}
              onChange={(e) => updateSetting('loki_retention_days', parseInt(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buildpack Configuration</CardTitle>
          <CardDescription>Configure build system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Buildpack Stack</Label>
            <Input
              value={settings.buildpack_default_stack || 'heroku-22'}
              onChange={(e) => updateSetting('buildpack_default_stack', e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.buildpack_cache_enabled === 'true' || settings.buildpack_cache_enabled === true}
              onChange={(e) => updateSetting('buildpack_cache_enabled', e.target.checked)}
              className="rounded"
            />
            <Label>Enable buildpack caching (faster builds)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};
