/**
 * Container Error Boundary Component
 * Catches and displays container-related errors in a user-friendly way
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createDisplayError, isConfigError, isBillingError, isQuotaError } from '@/lib/containerErrors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorDetails: any;
}

export class ContainerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorDetails: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorDetails = createDisplayError(error);
    return {
      hasError: true,
      error,
      errorDetails,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Container Error Boundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorDetails: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleGoToSettings = () => {
    window.location.href = '/admin/settings';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { errorDetails } = this.state;
      
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                {errorDetails?.title || 'Something went wrong'}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {errorDetails?.message || 'An unexpected error occurred while loading the container interface.'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Error-specific alerts */}
              {isConfigError(errorDetails?.code) && (
                <Alert className="border-orange-200 bg-orange-50">
                  <Settings className="w-4 h-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    This appears to be a configuration issue. Please contact your administrator to configure Easypanel integration.
                  </AlertDescription>
                </Alert>
              )}
              
              {isBillingError(errorDetails?.code) && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-blue-800">
                    This is a billing-related issue. Please check your subscription status and wallet balance.
                  </AlertDescription>
                </Alert>
              )}
              
              {isQuotaError(errorDetails?.code) && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertDescription className="text-yellow-800">
                    You've reached your resource limits. Consider upgrading your plan or reducing resource usage.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Suggested actions */}
              {errorDetails?.actions && errorDetails.actions.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Suggested Actions:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {errorDetails.actions.map((action: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Error details for development */}
              {process.env.NODE_ENV === 'development' && errorDetails?.details && (
                <details className="bg-gray-100 rounded-lg p-4">
                  <summary className="font-medium text-gray-700 cursor-pointer">
                    Technical Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                    {JSON.stringify(errorDetails.details, null, 2)}
                  </pre>
                </details>
              )}
              
              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={this.handleRetry}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={this.handleGoHome}
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
                
                {isConfigError(errorDetails?.code) && (
                  <Button 
                    variant="outline" 
                    onClick={this.handleGoToSettings}
                    className="flex-1"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withContainerErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ContainerErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ContainerErrorBoundary>
  );
  
  WrappedComponent.displayName = `withContainerErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Simple error fallback component
export function ContainerErrorFallback({ 
  error, 
  onRetry 
}: { 
  error?: any; 
  onRetry?: () => void; 
}) {
  const errorDetails = error ? createDisplayError(error) : null;
  
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {errorDetails?.title || 'Error Loading Content'}
      </h3>
      <p className="text-gray-600 mb-4 max-w-md">
        {errorDetails?.message || 'Something went wrong while loading this content.'}
      </p>
      {onRetry && (
        <Button onClick={onRetry} size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}