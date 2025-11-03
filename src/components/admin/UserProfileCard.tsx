import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Calendar, Building } from 'lucide-react';

interface UserProfileCardProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
    updated_at: string;
    organizations: Array<{
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      role: string;
    }>;
  };
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({ user }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-base font-semibold">{user.name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-base">{user.email}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <div className="mt-1">
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role === 'admin' ? 'Administrator' : 'User'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Account Status</label>
              <div className="mt-1">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Active
                </Badge>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-base">{formatDate(user.created_at)}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-base">{formatDate(user.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Organizations */}
        {user.organizations.length > 0 && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block">
              Organizations
            </label>
            <div className="space-y-2">
              {user.organizations.map((org) => (
                <div
                  key={org.organizationId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{org.organizationName}</p>
                      <p className="text-sm text-muted-foreground">@{org.organizationSlug}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {org.role}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {user.organizations.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No organization memberships</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};