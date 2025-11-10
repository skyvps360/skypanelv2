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

const SENSITIVE_PLACEHOLDER = '***REDACTED***';
const isSensitiveKey = (key: string): boolean => {
  const lowered = key.toLowerCase();
  return lowered.includes('secret') || lowered.includes('token') || lowered.includes('password') || lowered.includes('key');
};

export const PaaSSettingsAdmin: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [originalSettings, setOriginalSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await apiClient.get('/admin/paas/settings');
      const nextSettings: Record<string, any> = {};
      (data.settings || []).forEach((setting: any) => {
        nextSettings[setting.key] = parseSettingValue(setting);
      });

      setSettings(nextSettings);
      setOriginalSettings({ ...nextSettings });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const parseSettingValue = (setting: any) => {
    const raw = setting.value_encrypted ?? '';

    if (typeof raw === 'string' && raw === SENSITIVE_PLACEHOLDER && setting.is_sensitive) {
      return SENSITIVE_PLACEHOLDER;
    }

    switch (setting.value_type) {
      case 'number':
        return raw === '' ? '' : Number(raw);
      case 'boolean':
        if (typeof raw === 'boolean') {
          return raw;
        }
        if (typeof raw === 'string') {
          return raw.toLowerCase() === 'true';
        }
        return Boolean(raw);
      case 'json':
        if (!raw) return {};
        try {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return raw;
        }
      default:
        return raw;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes: Record<string, any> = {};
      for (const [key, value] of Object.entries(settings)) {
        if (originalSettings[key] !== value) {
          changes[key] = value;
        }
      }

      if (Object.keys(changes).length === 0) {
        toast.info('No changes to save');
        return;
      }

      await apiClient.put('/admin/paas/settings', { settings: changes });
      toast.success('Settings saved successfully');
      setOriginalSettings({ ...settings });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  const getDisplayValue = (key: string) => {
    const value = settings[key];
    if (typeof value === 'string' && value === SENSITIVE_PLACEHOLDER && isSensitiveKey(key)) {
      return '';
    }
    return value ?? '';
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
              value={getDisplayValue('default_domain')}
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
              value={settings.max_apps_per_org === '' || settings.max_apps_per_org === undefined ? '' : settings.max_apps_per_org}
              onChange={(e) =>
                updateSetting(
                  'max_apps_per_org',
                  e.target.value === '' ? '' : parseInt(e.target.value, 10)
                )
              }
              placeholder="0 = unlimited"
            />
          </div>

          <div>
            <Label>Max Deployments Per Hour</Label>
            <Input
              type="number"
              value={
                settings.max_deployments_per_hour === '' || settings.max_deployments_per_hour === undefined
                  ? ''
                  : settings.max_deployments_per_hour
              }
              onChange={(e) =>
                updateSetting(
                  'max_deployments_per_hour',
                  e.target.value === '' ? '' : parseInt(e.target.value, 10)
                )
              }
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
                  value={getDisplayValue('s3_bucket')}
                  onChange={(e) => updateSetting('s3_bucket', e.target.value)}
                  placeholder="my-paas-builds"
                />
              </div>
              <div>
                <Label>S3 Region</Label>
                <Input
                  value={getDisplayValue('s3_region')}
                  onChange={(e) => updateSetting('s3_region', e.target.value)}
                  placeholder="us-east-1"
                />
              </div>
              <div>
                <Label>S3 Access Key</Label>
                <Input
                  value={getDisplayValue('s3_access_key')}
                  onChange={(e) => updateSetting('s3_access_key', e.target.value)}
                  placeholder="AKIA..."
                />
              </div>
              <div>
                <Label>S3 Secret Key</Label>
                <Input
                  type="password"
                  value={getDisplayValue('s3_secret_key')}
                  onChange={(e) => updateSetting('s3_secret_key', e.target.value)}
                />
              </div>
              <div>
                <Label>S3 Endpoint (optional, for MinIO/B2)</Label>
                <Input
                  value={getDisplayValue('s3_endpoint')}
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
                value={getDisplayValue('local_storage_path') || '/var/paas/storage'}
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
              value={getDisplayValue('loki_endpoint') || 'http://localhost:3100'}
              onChange={(e) => updateSetting('loki_endpoint', e.target.value)}
            />
          </div>
          <div>
            <Label>Log Retention (days)</Label>
            <Input
              type="number"
              value={
                settings.loki_retention_days === '' || settings.loki_retention_days === undefined
                  ? ''
                  : settings.loki_retention_days
              }
              onChange={(e) =>
                updateSetting(
                  'loki_retention_days',
                  e.target.value === '' ? '' : parseInt(e.target.value, 10)
                )
              }
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
              value={getDisplayValue('buildpack_default_stack') || 'heroku-22'}
              onChange={(e) => updateSetting('buildpack_default_stack', e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={Boolean(settings.buildpack_cache_enabled)}
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
