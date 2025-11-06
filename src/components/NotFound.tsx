/**
 * NotFound component for handling 404 scenarios
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NotFoundProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showSearchSuggestion?: boolean;
  onBack?: () => void;
  onHome?: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({
  title = "Page Not Found",
  message = "The page you're looking for doesn't exist or has been moved.",
  showBackButton = true,
  showHomeButton = true,
  showSearchSuggestion = false,
  onBack,
  onHome,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleHome = () => {
    if (onHome) {
      onHome();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="text-6xl font-bold text-muted-foreground mb-2">404</div>
          <h1 className="text-2xl font-semibold mb-2">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        {showSearchSuggestion && (
          <Alert className="mb-6 text-left">
            <Search className="h-4 w-4" />
            <AlertTitle>Looking for something specific?</AlertTitle>
            <AlertDescription>
              Try using the search function or check the navigation menu to find what you need.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showBackButton && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          )}
          {showHomeButton && (
            <Button
              onClick={handleHome}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Specialized NotFound components for different contexts
 */
export const UserNotFound: React.FC<{ userId?: string }> = ({ userId }) => (
  <NotFound
    title="User Not Found"
    message={
      userId
        ? `User with ID "${userId}" could not be found.`
        : "The requested user could not be found."
    }
    showSearchSuggestion={true}
  />
);

export const OrganizationNotFound: React.FC<{ organizationId?: string }> = ({ organizationId }) => (
  <NotFound
    title="Organization Not Found"
    message={
      organizationId
        ? `Organization with ID "${organizationId}" could not be found.`
        : "The requested organization could not be found."
    }
    showSearchSuggestion={true}
  />
);

export const PageNotFound: React.FC = () => (
  <NotFound
    title="Page Not Found"
    message="The page you're looking for doesn't exist or has been moved."
    showSearchSuggestion={true}
  />
);

/**
 * Hook for handling not found scenarios
 */
export function useNotFoundHandler() {
  const navigate = useNavigate();

  const handleUserNotFound = React.useCallback((userId?: string) => {
    navigate('/admin/users', { 
      state: { 
        error: userId 
          ? `User with ID "${userId}" could not be found.`
          : "The requested user could not be found."
      }
    });
  }, [navigate]);

  const handleOrganizationNotFound = React.useCallback((organizationId?: string) => {
    navigate('/admin/users', { 
      state: { 
        error: organizationId 
          ? `Organization with ID "${organizationId}" could not be found.`
          : "The requested organization could not be found."
      }
    });
  }, [navigate]);

  return {
    handleUserNotFound,
    handleOrganizationNotFound,
  };
}