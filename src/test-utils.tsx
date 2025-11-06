import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';
import { vi } from 'vitest';

// Create a complete mock AuthContext
export const createMockAuthContext = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: {
    id: 'test-user-id',
    email: 'admin@test.com',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    emailVerified: true,
  },
  token: 'mock-jwt-token',
  loading: false,
  isImpersonating: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  updateProfile: vi.fn(),
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  changePassword: vi.fn(),
  updatePreferences: vi.fn(),
  getApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  ...overrides,
});

// Render component with auth context and query client
export const renderWithAuth = (
  component: React.ReactElement,
  authContextOverrides: Partial<AuthContextType> = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const mockAuthContext = createMockAuthContext(authContextOverrides);

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthContext}>
        {component}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

export * from '@testing-library/react';