import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaaSDashboard } from '../PaaSDashboard';

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    loading: false,
    user: {
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      emailVerified: true
    },
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
    revokeApiKey: vi.fn()
  })
}));

vi.mock('@/components/ui/dropdown-menu', async () => {
  const ReactModule = await import('react');
  const React = ReactModule as unknown as typeof import('react');

  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    DropdownMenuSeparator: () => <hr />
  };
});

type JsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
};

const createJsonResponse = (data: any, status = 200): JsonResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data
});

vi.stubEnv('NODE_ENV', 'test');

describe('PaaS dashboard lifecycle actions', () => {
  const user = userEvent.setup();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('calls the start endpoint and refreshes data', async () => {
    let appStatus: 'stopped' | 'deployed' = 'stopped';

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/paas/apps') {
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            apps: [
              {
                id: 'app-123',
                name: 'Demo App',
                description: 'Sample application',
                status: appStatus,
                repository_url: 'https://github.com/example/repo',
                branch: 'main',
                plan_name: 'Basic',
                addon_count: 0,
                created_at: '2024-01-01T00:00:00.000Z',
                updated_at: '2024-01-01T00:00:00.000Z'
              }
            ]
          }
        }));
      }

      if (url === '/api/paas/stats') {
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            total_apps: 1,
            deployed_apps: appStatus === 'deployed' ? 1 : 0,
            building_apps: 0,
            error_apps: 0,
            total_deployments: 0,
            total_addons: 0,
            monthly_spend: 0
          }
        }));
      }

      if (url === '/api/paas/apps/app-123/start') {
        expect(init?.method).toBe('POST');
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
        appStatus = 'deployed';
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            status: 'deployed',
            app: {
              id: 'app-123',
              name: 'Demo App',
              status: 'deployed',
              repository_url: 'https://github.com/example/repo',
              branch: 'main',
              updated_at: new Date().toISOString()
            },
            message: 'Application started successfully'
          }
        }));
      }

      return Promise.resolve(createJsonResponse({ success: true }));
    });

    render(
      <MemoryRouter>
        <PaaSDashboard />
      </MemoryRouter>
    );

    await screen.findByText('Demo App');

    const startButton = await screen.findByRole('button', { name: /start/i });
    await user.click(startButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/paas/apps/app-123/start', expect.any(Object));
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Application started successfully');
    });
  });

  it('calls the stop endpoint and refreshes data', async () => {
    let appStatus: 'deployed' | 'stopped' = 'deployed';

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/paas/apps') {
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            apps: [
              {
                id: 'app-123',
                name: 'Demo App',
                description: 'Sample application',
                status: appStatus,
                repository_url: 'https://github.com/example/repo',
                branch: 'main',
                plan_name: 'Basic',
                addon_count: 0,
                created_at: '2024-01-01T00:00:00.000Z',
                updated_at: '2024-01-01T00:00:00.000Z'
              }
            ]
          }
        }));
      }

      if (url === '/api/paas/stats') {
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            total_apps: 1,
            deployed_apps: appStatus === 'deployed' ? 1 : 0,
            building_apps: 0,
            error_apps: 0,
            total_deployments: 0,
            total_addons: 0,
            monthly_spend: 0
          }
        }));
      }

      if (url === '/api/paas/apps/app-123/stop') {
        expect(init?.method).toBe('POST');
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
        appStatus = 'stopped';
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            status: 'stopped',
            app: {
              id: 'app-123',
              name: 'Demo App',
              status: 'stopped',
              repository_url: 'https://github.com/example/repo',
              branch: 'main',
              updated_at: new Date().toISOString()
            },
            message: 'Application stopped successfully'
          }
        }));
      }

      return Promise.resolve(createJsonResponse({ success: true }));
    });

    render(
      <MemoryRouter>
        <PaaSDashboard />
      </MemoryRouter>
    );

    await screen.findByText('Demo App');

    const stopButton = await screen.findByRole('button', { name: /stop/i });
    await user.click(stopButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/paas/apps/app-123/stop', expect.any(Object));
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Application stopped successfully');
    });
  });

  it('calls the redeploy endpoint and shows confirmation', async () => {
    let appStatus: 'deployed' | 'building' = 'deployed';

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/paas/apps') {
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            apps: [
              {
                id: 'app-123',
                name: 'Demo App',
                description: 'Sample application',
                status: appStatus,
                repository_url: 'https://github.com/example/repo',
                branch: 'main',
                plan_name: 'Basic',
                addon_count: 0,
                created_at: '2024-01-01T00:00:00.000Z',
                updated_at: '2024-01-01T00:00:00.000Z'
              }
            ]
          }
        }));
      }

      if (url === '/api/paas/stats') {
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            total_apps: 1,
            deployed_apps: appStatus === 'deployed' ? 1 : 0,
            building_apps: appStatus === 'building' ? 1 : 0,
            error_apps: 0,
            total_deployments: 0,
            total_addons: 0,
            monthly_spend: 0
          }
        }));
      }

      if (url === '/api/paas/apps/app-123/redeploy') {
        expect(init?.method).toBe('POST');
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
        appStatus = 'building';
        return Promise.resolve(createJsonResponse({
          success: true,
          data: {
            deploymentId: 'deploy-1',
            status: 'building',
            app: {
              id: 'app-123',
              name: 'Demo App',
              status: 'building',
              repository_url: 'https://github.com/example/repo',
              branch: 'main',
              updated_at: new Date().toISOString()
            },
            message: 'Redeployment started successfully'
          }
        }));
      }

      return Promise.resolve(createJsonResponse({ success: true }));
    });

    render(
      <MemoryRouter>
        <PaaSDashboard />
      </MemoryRouter>
    );

    await screen.findByText('Demo App');

    const redeployButton = await screen.findByRole('button', { name: /redeploy/i });
    await user.click(redeployButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/paas/apps/app-123/redeploy', expect.any(Object));
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Redeployment triggered successfully');
    });
  });
});
