import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberAddModal } from '../MemberAddModal';
import { renderWithAuth } from '@/test-utils';

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
    memberAdd: {
      userId: {},
      role: {},
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

// Mock props
const mockProps = {
  organizationId: 'test-org-id',
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
};

describe('MemberAddModal', () => {
  const mockProps = {
    organizationId: '1',
    organizationName: 'Test Organization',
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
    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    expect(screen.getByText('Add Member to Organization')).toBeInTheDocument();
    expect(screen.getByText('Add a new member to "Test Organization" and assign them a role.')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    renderWithAuth(<MemberAddModal {...mockProps} open={false} />);
    
    expect(screen.queryByText('Add Member to Organization')).not.toBeInTheDocument();
  });

  it('renders form fields', () => {
    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    expect(screen.getByText(/select user/i)).toBeInTheDocument();
    expect(screen.getByText(/member role/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('searches users when typing in user field', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        users: [
          { 
            id: '2', 
            name: 'John Doe', 
            email: 'john@test.com', 
            role: 'user',
            isAlreadyMember: false,
            organizations: []
          },
        ],
      }),
    });

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/search?q=john&organizationId=1'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('displays user search results', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        users: [
          { 
            id: '2', 
            name: 'John Doe', 
            email: 'john@test.com', 
            role: 'user',
            isAlreadyMember: false,
            organizations: []
          },
        ],
      }),
    });

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@test.com • user')).toBeInTheDocument();
    });
  });

  it('shows already member badge for existing members', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        users: [
          { 
            id: '2', 
            name: 'John Doe', 
            email: 'john@test.com', 
            role: 'user',
            isAlreadyMember: true,
            organizations: [{ id: '1', name: 'Test Organization', role: 'member' }]
          },
        ],
      }),
    });

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getAllByText('Already Member')).toHaveLength(2); // One in dropdown, one in button
    });
  });

  it('selects user from search results', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        users: [
          { 
            id: '2', 
            name: 'John Doe', 
            email: 'john@test.com', 
            role: 'user',
            isAlreadyMember: false,
            organizations: []
          },
        ],
      }),
    });

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('John Doe'));
    
    await waitFor(() => {
      expect(screen.getByText('John Doe (john@test.com)')).toBeInTheDocument();
    });
  });

  it('changes member role', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    const roleSelect = screen.getByRole('combobox', { name: /member role/i });
    await user.click(roleSelect);
    
    await user.click(screen.getByText('Admin'));
    
    expect(screen.getByDisplayValue('admin')).toBeInTheDocument();
  });

  it('shows ownership transfer warning for owner role', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    const roleSelect = screen.getByRole('combobox', { name: /member role/i });
    await user.click(roleSelect);
    
    await user.click(screen.getByText('Owner'));
    
    expect(screen.getByText('Ownership Transfer')).toBeInTheDocument();
    expect(screen.getByText(/selecting "Owner" will transfer ownership/i)).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          users: [
            { 
              id: '2', 
              name: 'John Doe', 
              email: 'john@test.com', 
              role: 'user',
              isAlreadyMember: false,
              organizations: []
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ member: { userId: '2', role: 'member' } }),
      });

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    // Select user
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('John Doe'));
    
    // Submit form
    await user.click(screen.getByText('Add Member'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/organizations/1/members'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: JSON.stringify({
            userId: '2',
            role: 'member',
          }),
        })
      );
    });
  });

  it('handles API error during submission', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          users: [
            { 
              id: '2', 
              name: 'John Doe', 
              email: 'john@test.com', 
              role: 'user',
              isAlreadyMember: false,
              organizations: []
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'User is already a member' }),
      });

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    // Select user
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('John Doe'));
    
    // Submit form
    await user.click(screen.getByText('Add Member'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('disables submit button for already member users', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        users: [
          { 
            id: '2', 
            name: 'John Doe', 
            email: 'john@test.com', 
            role: 'user',
            isAlreadyMember: true,
            organizations: [{ id: '1', name: 'Test Organization', role: 'member' }]
          },
        ],
      }),
    });

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('John Doe'));
    
    await waitFor(() => {
      expect(screen.getByText('Add Member')).toBeDisabled();
    });
  });

  it('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          users: [
            { 
              id: '2', 
              name: 'John Doe', 
              email: 'john@test.com', 
              role: 'user',
              isAlreadyMember: false,
              organizations: []
            },
          ],
        }),
      })
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithAuth(<MemberAddModal {...mockProps} />);
    
    // Select user
    const userButton = screen.getByRole('combobox');
    await user.click(userButton);
    
    const searchInput = screen.getByPlaceholderText(/search users by name or email/i);
    await user.type(searchInput, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('John Doe'));
    
    // Submit form
    await user.click(screen.getByText('Add Member'));
    
    expect(screen.getByText('Adding...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });
});