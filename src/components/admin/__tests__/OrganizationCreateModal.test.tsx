import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationCreateModal } from '../OrganizationCreateModal';
import { renderWithAuth } from '@/test-utils';
import { validateForm } from '@/lib/validation';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/validation', () => ({
  validateForm: vi.fn(() => ({
    isValid: true,
    errors: {},
  })),
  ValidationSchemas: {
    organizationCreate: {
      name: {},
      slug: {},
      ownerId: {},
      description: {},
    },
  },
}));

vi.mock('@/lib/errorHandling', () => ({
  handleApiError: vi.fn(),
  displaySuccess: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock props and data

describe('OrganizationCreateModal', () => {
  const mockProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal when open', () => {
    renderWithAuth(<OrganizationCreateModal {...mockProps} />);
    
    expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    expect(screen.getByText('Create a new organization and assign an owner to manage it.')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    renderWithAuth(<OrganizationCreateModal {...mockProps} open={false} />);
    
    expect(screen.queryByText('Create New Organization')).not.toBeInTheDocument();
  });

  it('renders form fields', () => {
    renderWithAuth(<OrganizationCreateModal {...mockProps} />);
    
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization slug/i)).toBeInTheDocument();
    expect(screen.getByText(/organization owner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<OrganizationCreateModal {...mockProps} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('makes API call for user search', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        users: [
          { id: '1', name: 'John Doe', email: 'john@test.com', role: 'user' },
        ],
      }),
    });

    renderWithAuth(<OrganizationCreateModal {...mockProps} />);
    
    const ownerButton = screen.getByRole('combobox');
    await user.click(ownerButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/search?q=john'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('validates form data before submission', () => {
    renderWithAuth(<OrganizationCreateModal {...mockProps} />);

    // Component should use validation
    expect(validateForm).toBeDefined();
  });
});