/**
 * Settings Page
 * User and organization settings management
 */

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building, 
  Key, 
  Bell, 
  Shield, 
  Save,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
// Navigation provided by AppLayout
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Settings: React.FC = () => {
  const { 
    user, 
    updateProfile, 
    getOrganization,
    updateOrganization, 
    changePassword, 
    updatePreferences, 
    getApiKeys, 
    createApiKey, 
    revokeApiKey 
  } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState<{[key: string]: boolean}>({});
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState<{[key: string]: string}>({});
  const [revokeModal, setRevokeModal] = useState<{isOpen: boolean, keyId: string, keyName: string}>({
    isOpen: false,
    keyId: '',
    keyName: ''
  });

  // Profile settings
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    timezone: user?.timezone || 'UTC'
  });

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        timezone: user.timezone || 'UTC'
      });
    }
  }, [user]);

  // Organization settings
  const [orgData, setOrgData] = useState({
    name: '',
    website: '',
    address: '',
    taxId: ''
  });

  // Security settings
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false
  });

  // Notification settings
  const [notificationData, setNotificationData] = useState({
    emailNotifications: true,
    smsNotifications: false,
    billingAlerts: true,
    securityAlerts: true,
    maintenanceAlerts: true
  });

  // API settings
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');

  // Load API keys on mount
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const keys = await getApiKeys();
        setApiKeys(keys);
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    };
    loadApiKeys();
  }, [getApiKeys]);

  // Load organization data on mount
  useEffect(() => {
    const loadOrganizationData = async () => {
      try {
        const organization = await getOrganization();
        setOrgData({
          name: organization.name || '',
          website: organization.website || '',
          address: organization.address || '',
          taxId: organization.taxId || ''
        });
      } catch (error) {
        console.error('Failed to load organization data:', error);
        // Keep empty values if loading fails
      }
    };
    loadOrganizationData();
  }, [getOrganization]);

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'organization', name: 'Organization', icon: Building },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'api', name: 'API Keys', icon: Key }
  ];

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await updateProfile({ 
        firstName: profileData.firstName, 
        lastName: profileData.lastName,
        phone: profileData.phone,
        timezone: profileData.timezone
      });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrganization = async () => {
    setLoading(true);
    try {
      await updateOrganization(
        orgData.name,
        orgData.website,
        orgData.address,
        orgData.taxId
      );
      toast.success('Organization settings updated successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update organization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (!securityData.currentPassword || !securityData.newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    setLoading(true);
    try {
      await changePassword(securityData.currentPassword, securityData.newPassword);
      setSecurityData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      toast.success('Password changed successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      await updatePreferences({
        notifications: {
          email: notificationData.emailNotifications,
          sms: notificationData.smsNotifications,
          billingAlerts: notificationData.billingAlerts,
          securityAlerts: notificationData.securityAlerts,
          maintenanceAlerts: notificationData.maintenanceAlerts
        }
      });
      toast.success('Notification preferences updated successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyApiKey = (keyId: string, key: string) => {
    // For newly created keys, copy the full key. For existing keys, copy the preview
    const fullKey = newlyCreatedKeys[keyId] || key;
    navigator.clipboard.writeText(fullKey);
    toast.success('API key copied to clipboard');
  };

  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    setLoading(true);
    try {
      const newKey = await createApiKey(newApiKeyName);
      setApiKeys(prev => [...prev, newKey]);
      // Store the full key for this session only
      if (newKey.key) {
        setNewlyCreatedKeys(prev => ({ ...prev, [newKey.id]: newKey.key }));
      }
      setNewApiKeyName('');
      toast.success('API key created successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    setLoading(true);
    try {
      await revokeApiKey(keyId);
      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      // Remove from newly created keys if it exists
      setNewlyCreatedKeys(prev => {
        const updated = { ...prev };
        delete updated[keyId];
        return updated;
      });
      setRevokeModal({ isOpen: false, keyId: '', keyName: '' });
      toast.success('API key revoked successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  const openRevokeModal = (keyId: string, keyName: string) => {
    setRevokeModal({ isOpen: true, keyId, keyName });
  };

  const closeRevokeModal = () => {
    setRevokeModal({ isOpen: false, keyId: '', keyName: '' });
  };

  const toggleApiKeyVisibility = (keyId: string) => {
    setShowApiKey(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const getDisplayKey = (key: any) => {
    const isVisible = showApiKey[key.id];
    const hasFullKey = newlyCreatedKeys[key.id];
    
    if (!isVisible) {
      return '••••••••••••••••••••••••••••••••';
    }
    
    if (hasFullKey) {
      return newlyCreatedKeys[key.id];
    }
    
    return key.key_preview || key.key;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    First Name
                  </label>
                  <Input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full rounded-md border bg-secondary text-foreground shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Last Name
                  </label>
                  <Input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full rounded-md border bg-secondary text-foreground shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={profileData.email}
                    disabled
                    title="Email changes are not supported in the current schema"
                    className="w-full rounded-md border shadow-sm bg-muted text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border bg-secondary text-foreground shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Timezone
                  </label>
                  <Select
                    value={profileData.timezone}
                    onValueChange={(value) => setProfileData(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-6">
                <Button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="inline-flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'organization':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">Organization Details</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Organization Name
                  </label>
                  <Input
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Website
                  </label>
                  <Input
                    type="url"
                    value={orgData.website}
                    onChange={(e) => setOrgData(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Address
                  </label>
                  <Textarea
                    value={orgData.address}
                    onChange={(e) => setOrgData(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Tax ID
                  </label>
                  <Input
                    type="text"
                    value={orgData.taxId}
                    onChange={(e) => setOrgData(prev => ({ ...prev, taxId: e.target.value }))}
                    className="w-full rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
              </div>
              <div className="mt-6">
                <Button
                  onClick={handleSaveOrganization}
                  disabled={loading}
                  className="inline-flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={securityData.currentPassword}
                    onChange={(e) => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={securityData.newPassword}
                    onChange={(e) => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={securityData.confirmPassword}
                    onChange={(e) => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={loading || !securityData.currentPassword || !securityData.newPassword || !securityData.confirmPassword}
                  className="inline-flex items-center"
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </div>

            <div className="border-t border pt-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Two-Factor Authentication</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  checked={securityData.twoFactorEnabled}
                  onCheckedChange={(checked) => setSecurityData(prev => ({ ...prev, twoFactorEnabled: checked }))}
                />
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Email Notifications</h4>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notificationData.emailNotifications}
                    onCheckedChange={(checked) => setNotificationData(prev => ({ ...prev, emailNotifications: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">SMS Notifications</h4>
                    <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                  </div>
                  <Switch
                    checked={notificationData.smsNotifications}
                    onCheckedChange={(checked) => setNotificationData(prev => ({ ...prev, smsNotifications: checked }))}
                  />
                </div>

                <div className="border-t border pt-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">Alert Types</h4>
                  <div className="space-y-3">
                    {[
                      { key: 'billingAlerts', label: 'Billing Alerts', description: 'Payment and billing notifications' },
                      { key: 'securityAlerts', label: 'Security Alerts', description: 'Security-related notifications' },
                      { key: 'maintenanceAlerts', label: 'Maintenance Alerts', description: 'Scheduled maintenance notifications' }
                    ].map((alert) => (
                      <div key={alert.key} className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-medium text-foreground">{alert.label}</h5>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                        </div>
                        <Switch
                          checked={notificationData[alert.key as keyof typeof notificationData] as boolean}
                          onCheckedChange={(checked) => setNotificationData(prev => ({ ...prev, [alert.key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <Button
                  onClick={handleSaveNotifications}
                  disabled={loading}
                  className="inline-flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">API Keys</h3>
              <div className="bg-warning/10 border border-warning/20 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Shield className="h-5 w-5 text-warning" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-warning">
                      Keep your API keys secure
                    </h3>
                    <div className="mt-2 text-sm text-warning">
                      <p>
                        API keys provide access to your account. Keep them secure and never share them publicly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Create new API key */}
              <div className="border border rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-foreground mb-4">Create New API Key</h4>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter API key name"
                    value={newApiKeyName}
                    onChange={(e) => setNewApiKeyName(e.target.value)}
                    className="flex-1 rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary"
                  />
                  <Button
                    onClick={handleCreateApiKey}
                    disabled={loading || !newApiKeyName.trim()}
                    className="inline-flex items-center"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    {loading ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>

              {/* Existing API keys */}
              <div className="space-y-4">
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground " />
                    <p>No API keys found. Create your first API key above.</p>
                  </div>
                ) : (
                  apiKeys.map((key) => (
                    <div key={key.id} className="border border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-medium text-foreground">{key.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(key.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                          Active
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 relative">
                          <Input
                            type="text"
                            value={getDisplayKey(key)}
                            readOnly
                            className="w-full rounded-md border bg-muted shadow-sm focus:border-primary focus:ring-primary font-mono text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleApiKeyVisibility(key.id)}
                          title={showApiKey[key.id] ? 'Hide API key' : 'Show API key'}
                        >
                          {showApiKey[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyApiKey(key.id, key.key_preview || key.key)}
                          title="Copy API key"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Security notice for existing keys */}
                      {!newlyCreatedKeys[key.id] && showApiKey[key.id] && (
                        <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-md">
                          <div className="flex">
                            <Shield className="h-4 w-4 text-info mt-0.5 mr-2 flex-shrink-0" />
                            <div className="text-sm text-info">
                              <p className="font-medium">Security Notice</p>
                              <p>For security reasons, only the prefix of existing API keys can be displayed. The full key was only shown when it was first created.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openRevokeModal(key.id, key.name)}
                          disabled={loading}
                          className="inline-flex items-center"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {loading ? 'Revoking...' : 'Revoke'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Revocation Confirmation Modal */}
            <Dialog open={revokeModal.isOpen} onOpenChange={closeRevokeModal}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <div className="flex items-center">
                    <AlertTriangle className="h-6 w-6 text-destructive mr-3" />
                    <DialogTitle>Revoke API Key</DialogTitle>
                  </div>
                  <DialogDescription className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Are you sure you want to revoke the API key:
                    </p>
                    <p className="text-sm font-medium text-foreground bg-muted px-3 py-2 rounded border">
                      {revokeModal.keyName}
                    </p>
                    <p className="text-sm text-destructive mt-2">
                      This action cannot be undone. Any applications using this key will lose access immediately.
                    </p>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={closeRevokeModal}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleRevokeApiKey(revokeModal.keyId)}
                    disabled={loading}
                  >
                    {loading ? 'Revoking...' : 'Revoke API Key'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );



      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "secondary" : "ghost"}
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full justify-start"
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {tab.name}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-card shadow sm:rounded-lg border border">
              <div className="px-6 py-6">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
