import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  ArrowLeft,
  ExternalLink,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Trash2,
  Settings,
  GitBranch,
  Terminal,
  Database,
  Key,
} from 'lucide-react';

interface Application {
  id: number;
  name: string;
  slug: string;
  status: string;
  system_domain: string;
  git_repo_url: string | null;
  git_branch: string;
  auto_deploy: boolean;
  instance_count: number;
  created_at: string;
}

interface Build {
  id: number;
  build_number: number;
  git_commit_sha: string | null;
  git_commit_message: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface EnvVar {
  id: number;
  key: string;
  value: string;
  created_at: string;
}

export default function PaaSAppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [buildLogs, setBuildLogs] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [envFormData, setEnvFormData] = useState({ key: '', value: '' });
  const [gitFormData, setGitFormData] = useState({
    git_repo_url: '',
    git_branch: 'main',
    git_oauth_token: '',
    auto_deploy: false,
  });

  useEffect(() => {
    fetchApp();
    fetchBuilds();
    fetchEnvVars();
  }, [id]);

  const fetchApp = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setApp(data.application);
        setGitFormData({
          git_repo_url: data.application.git_repo_url || '',
          git_branch: data.application.git_branch || 'main',
          git_oauth_token: '',
          auto_deploy: data.application.auto_deploy || false,
        });
      }
    } catch (error) {
      console.error('Error fetching application:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuilds = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}/builds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setBuilds(data.builds);
      }
    } catch (error) {
      console.error('Error fetching builds:', error);
    }
  };

  const fetchEnvVars = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}/env`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setEnvVars(data.variables);
      }
    } catch (error) {
      console.error('Error fetching env vars:', error);
    }
  };

  const handleDeploy = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}/deploy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        await fetchApp();
        await fetchBuilds();
      }
    } catch (error) {
      console.error('Error deploying application:', error);
    }
  };

  const handleAction = async (action: 'restart' | 'stop' | 'start') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        await fetchApp();
      }
    } catch (error) {
      console.error(`Error ${action} application:`, error);
    }
  };

  const handleViewLogs = async (build: Build) => {
    setSelectedBuild(build);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/paas/applications/${id}/builds/${build.id}/logs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setBuildLogs(data.logs || 'No logs available');
        setShowLogsModal(true);
      }
    } catch (error) {
      console.error('Error fetching build logs:', error);
    }
  };

  const handleSaveGitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(gitFormData),
      });
      const data = await response.json();
      if (data.success) {
        await fetchApp();
        alert('Git configuration saved!');
      }
    } catch (error) {
      console.error('Error saving git config:', error);
    }
  };

  const handleAddEnvVar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}/env`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(envFormData),
      });
      const data = await response.json();
      if (data.success) {
        await fetchEnvVars();
        setEnvFormData({ key: '', value: '' });
        setShowEnvModal(false);
      }
    } catch (error) {
      console.error('Error adding env var:', error);
    }
  };

  const handleDeleteEnvVar = async (key: string) => {
    if (!confirm(`Delete environment variable ${key}?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}/env/${key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        await fetchEnvVars();
      }
    } catch (error) {
      console.error('Error deleting env var:', error);
    }
  };

  const handleDeleteApp = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/paas/applications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        navigate('/paas');
      }
    } catch (error) {
      console.error('Error deleting application:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'building': return 'bg-blue-500';
      case 'stopped': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      case 'success': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading || !app) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/paas')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Applications
      </Button>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">{app.name}</h1>
          <p className="text-gray-600 mt-1">{app.slug}</p>
          {app.system_domain && (
            <a
              href={`https://${app.system_domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-2"
            >
              {app.system_domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(app.status)}>
            {app.status}
          </Badge>
          {app.status === 'running' && (
            <>
              <Button variant="outline" onClick={() => handleAction('restart')}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart
              </Button>
              <Button variant="outline" onClick={() => handleAction('stop')}>
                <StopCircle className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          )}
          {app.status === 'stopped' && (
            <Button variant="outline" onClick={() => handleAction('start')}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Start
            </Button>
          )}
          {app.git_repo_url && (
            <Button onClick={handleDeploy}>
              <GitBranch className="h-4 w-4 mr-2" />
              Deploy
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="builds">Builds</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Application Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-semibold">{app.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Instances</p>
                <p className="font-semibold">{app.instance_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Git Branch</p>
                <p className="font-semibold">{app.git_branch || 'Not configured'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Auto Deploy</p>
                <p className="font-semibold">{app.auto_deploy ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Created</p>
                <p className="font-semibold">{new Date(app.created_at).toLocaleString()}</p>
              </div>
            </div>
          </Card>

          {!app.git_repo_url && (
            <Card className="p-6 bg-yellow-50 border-yellow-200">
              <h3 className="text-lg font-semibold mb-2">Configure Git Repository</h3>
              <p className="text-sm text-gray-700 mb-4">
                Connect your Git repository to enable automatic deployments
              </p>
              <Button onClick={() => navigate(`/paas/${id}#settings`)}>
                <GitBranch className="h-4 w-4 mr-2" />
                Configure Git
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="builds" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Build History</h3>
            {app.git_repo_url && (
              <Button onClick={handleDeploy}>
                <GitBranch className="h-4 w-4 mr-2" />
                Trigger New Build
              </Button>
            )}
          </div>

          {builds.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-gray-600">No builds yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {builds.map(build => (
                <Card key={build.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">Build #{build.build_number}</h4>
                        <Badge className={getStatusColor(build.status)}>
                          {build.status}
                        </Badge>
                      </div>
                      {build.git_commit_sha && (
                        <p className="text-sm text-gray-600">
                          Commit: {build.git_commit_sha.substring(0, 7)}
                        </p>
                      )}
                      {build.git_commit_message && (
                        <p className="text-sm text-gray-600">{build.git_commit_message}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(build.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewLogs(build)}
                    >
                      <Terminal className="h-4 w-4 mr-2" />
                      View Logs
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="environment" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Environment Variables</h3>
            <Button onClick={() => setShowEnvModal(true)}>
              <Key className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
          </div>

          {envVars.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-gray-600 mb-4">No environment variables configured</p>
              <Button onClick={() => setShowEnvModal(true)}>Add Your First Variable</Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {envVars.map(envVar => (
                <Card key={envVar.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-mono font-semibold">{envVar.key}</p>
                      <p className="font-mono text-sm text-gray-600">••••••••</p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteEnvVar(envVar.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Git Configuration</h3>
            <form onSubmit={handleSaveGitConfig} className="space-y-4">
              <div>
                <Label htmlFor="git_repo_url">Repository URL</Label>
                <Input
                  id="git_repo_url"
                  value={gitFormData.git_repo_url}
                  onChange={e => setGitFormData({ ...gitFormData, git_repo_url: e.target.value })}
                  placeholder="https://github.com/username/repo.git"
                />
              </div>
              <div>
                <Label htmlFor="git_branch">Branch</Label>
                <Input
                  id="git_branch"
                  value={gitFormData.git_branch}
                  onChange={e => setGitFormData({ ...gitFormData, git_branch: e.target.value })}
                  placeholder="main"
                />
              </div>
              <div>
                <Label htmlFor="git_oauth_token">OAuth Token (optional)</Label>
                <Input
                  id="git_oauth_token"
                  type="password"
                  value={gitFormData.git_oauth_token}
                  onChange={e => setGitFormData({ ...gitFormData, git_oauth_token: e.target.value })}
                  placeholder="ghp_xxxxxxxxxxxxx"
                />
              </div>
              <Button type="submit">
                <Settings className="h-4 w-4 mr-2" />
                Save Git Configuration
              </Button>
            </form>
          </Card>

          <Card className="p-6 border-red-200">
            <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
            <p className="text-sm text-gray-700 mb-4">
              Deleting this application will stop all instances and remove all data. This action cannot be undone.
            </p>
            <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Application
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Build Logs - #{selectedBuild?.build_number}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={buildLogs}
            readOnly
            className="font-mono text-xs h-96"
          />
          <DialogFooter>
            <Button onClick={() => setShowLogsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEnvModal} onOpenChange={setShowEnvModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment Variable</DialogTitle>
            <DialogDescription>
              Environment variables will be available to your application at runtime
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEnvVar} className="space-y-4">
            <div>
              <Label htmlFor="env_key">Key</Label>
              <Input
                id="env_key"
                value={envFormData.key}
                onChange={e => setEnvFormData({ ...envFormData, key: e.target.value.toUpperCase() })}
                placeholder="DATABASE_URL"
                required
              />
            </div>
            <div>
              <Label htmlFor="env_value">Value</Label>
              <Input
                id="env_value"
                value={envFormData.value}
                onChange={e => setEnvFormData({ ...envFormData, value: e.target.value })}
                placeholder="postgres://..."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEnvModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Variable</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{app.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteApp}>
              Delete Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
