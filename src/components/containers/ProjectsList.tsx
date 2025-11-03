import React, { useState } from 'react';
import { 
  Plus, 
  FolderOpen, 
  Calendar, 
  Container, 
  MoreVertical, 
  Eye, 
  Settings, 
  Trash2,
  Grid3X3,
  List
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContainerProject } from '@/types/containers';

interface ProjectsListProps {
  projects: ContainerProject[];
  loading?: boolean;
  onCreateProject: () => void;
  onViewProject: (project: ContainerProject) => void;
  onEditProject: (project: ContainerProject) => void;
  onDeleteProject: (project: ContainerProject) => void;
  className?: string;
}

interface ProjectCardProps {
  project: ContainerProject;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onView,
  onEdit,
  onDelete,
}) => {
  const serviceCount = project.services?.length || 0;
  const createdDate = new Date(project.createdAt).toLocaleDateString();

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3" onClick={onView}>
            <div className="p-2 bg-blue-100 rounded-lg">
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                {project.projectName}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <div className="flex items-center gap-1">
                  <Container className="h-3 w-3" />
                  <span>{serviceCount} service{serviceCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{createdDate}</span>
                </div>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Settings className="h-4 w-4" />
                Edit Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0" onClick={onView}>
        <div className="flex items-center justify-between">
          <Badge 
            variant={project.status === 'active' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {project.status}
          </Badge>
          
          {serviceCount > 0 && (
            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(project.updatedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface ProjectRowProps {
  project: ContainerProject;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({
  project,
  onView,
  onEdit,
  onDelete,
}) => {
  const serviceCount = project.services?.length || 0;
  const createdDate = new Date(project.createdAt).toLocaleDateString();

  return (
    <div className="group flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer">
      <div className="flex items-center gap-4" onClick={onView}>
        <div className="p-2 bg-blue-100 rounded-lg">
          <FolderOpen className="h-4 w-4 text-blue-600" />
        </div>
        
        <div className="flex-1">
          <div className="font-semibold group-hover:text-blue-600 transition-colors">
            {project.projectName}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{serviceCount} service{serviceCount !== 1 ? 's' : ''}</span>
            <span>Created {createdDate}</span>
            <Badge 
              variant={project.status === 'active' ? 'default' : 'secondary'}
              className="capitalize text-xs"
            >
              {project.status}
            </Badge>
          </div>
        </div>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <Settings className="h-4 w-4" />
            Edit Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={onDelete}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Delete Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const ProjectsList: React.FC<ProjectsListProps> = ({
  projects,
  loading = false,
  onCreateProject,
  onViewProject,
  onEditProject,
  onDeleteProject,
  className,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Projects</h2>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Projects</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={onCreateProject}>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <FolderOpen className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first project to start deploying containerized applications.
              </p>
              <Button onClick={onCreateProject}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onView={() => onViewProject(project)}
                  onEdit={() => onEditProject(project)}
                  onDelete={() => onDeleteProject(project)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onView={() => onViewProject(project)}
                  onEdit={() => onEditProject(project)}
                  onDelete={() => onDeleteProject(project)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectsList;