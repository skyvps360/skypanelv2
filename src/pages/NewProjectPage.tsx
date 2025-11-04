import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { containerService } from '@/services/containerService';
import { toast } from 'sonner';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const result = await containerService.getSubscription();
      setHasSubscription(result.success && result.subscription?.status === 'active');
    } catch (err) {
      console.error('Failed to check subscription:', err);
      setHasSubscription(false);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  const validateProjectName = (name: string): string | null => {
    if (!name) {
      return 'Project name is required';
    }
    if (name.length < 3) {
      return 'Project name must be at least 3 characters';
    }
    if (name.length > 50) {
      return 'Project name must be less than 50 characters';
    }
    if (!/^[a-z0-9-_]+$/.test(name)) {
      return 'Project name must contain only lowercase letters, numbers, hyphens, and underscores';
    }
    if (name.startsWith('-') || name.startsWith('_')) {
      return 'Project name cannot start with a hyphen or underscore';
    }
    if (name.endsWith('-') || name.endsWith('_')) {
      return 'Project name cannot end with a hyphen or underscore';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateProjectName(projectName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreating(true);

    try {
      const result = await containerService.createProject(projectName);

      if (!result.success || !result.project) {
        throw new Error(result.error || 'Failed to create project');
      }

      toast.success('Project created successfully!');
      navigate(`/containers/projects/${result.project.projectName}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleProjectNameChange = (value: string) => {
    // Convert to lowercase and replace spaces with hyphens
    const sanitized = value.toLowerCase().replace(/\s+/g, '-');
    setProjectName(sanitized);
    setError(null);
  };

  if (isCheckingSubscription) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!hasSubscription) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/containers')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Containers
          </Button>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need an active container subscription to create projects.{' '}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => navigate('/containers/plans')}
            >
              View available plans
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/containers')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Containers
        </Button>
        <h1 className="text-3xl font-bold">Create New Project</h1>
        <p className="text-muted-foreground mt-2">
          Projects help you organize your container services
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Choose a unique name for your project. This will be used to organize your services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="projectName">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => handleProjectNameChange(e.target.value)}
                placeholder="my-awesome-project"
                disabled={isCreating}
                className={error ? 'border-destructive' : ''}
              />
              <p className="text-sm text-muted-foreground">
                Use lowercase letters, numbers, hyphens, and underscores only
              </p>
              {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4 bg-muted/50">
              <h3 className="font-medium mb-2">What you can do with projects:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Deploy multiple services (apps, databases, etc.)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Share environment variables across services</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Manage resources and monitor performance</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Access your services only within your project scope</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isCreating || !projectName}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Project...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/containers')}
                disabled={isCreating}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
