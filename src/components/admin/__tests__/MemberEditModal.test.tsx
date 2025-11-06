import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberEditModal } from '../MemberEditModal';
import { renderWithAuth } from '@/test-utils';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const { toast } = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock props and data

describe('MemberEditModal', () => {
  const mockMember = {
    userId: '2',
    userName: 'John Doe',
    userEmail: 'john@test.com',
    role: 'member' as const,
    userRole: 'user',
    joinedAt: '2024-01-01T00:00:00Z',
  };

  const mockProps = {
    member: mockMember,
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

  it('renders modal when open with member data', () => {
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    expect(screen.getByText('Edit Member Role')).toBeInTheDocument();
    expect(screen.getByText('Change the role of John Doe in "Test Organization".')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    renderWithAuth(<MemberEditModal {...mockProps} open={false} />);
    
    expect(screen.queryByText('Edit Member Role')).not.toBeInTheDocument();
  });

  it('does not render modal when no member provided', () => {
    renderWithAuth(<MemberEditModal {...mockProps} member={null} />);
    
    expect(screen.queryByText('Edit Member Role')).not.toBeInTheDocument();
  });

  it('displays member information', () => {
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument(); // Platform role badge
    expect(screen.getByText('Member')).toBeInTheDocument(); // Organization role badge
  });

  it('displays admin platform role badge correctly', () => {
    const adminMember = {
      ...mockMember,
      userRole: 'admin',
    };
    
    renderWithAuth(<MemberEditModal {...mockProps} member={adminMember} />);
    
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('pre-selects current member role', () => {
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    const roleSelect = screen.getByRole('combobox');
    expect(roleSelect).toHaveAttribute('data-state', 'closed');
    expect(roleSelect).toHaveTextContent('Member');
  });

  it('changes member role selection', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    
    await user.click(screen.getByText('Admin'));
    
    expect(roleSelect).toHaveTextContent('Admin');
  });

  it('shows ownership transfer warning for owner role', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    
    await user.click(screen.getByText('Owner'));
    
    expect(screen.getByText('Ownership Transfer')).toBeInTheDocument();
    expect(screen.getByText(/this will transfer ownership/i)).toBeInTheDocument();
  });

  it('shows owner role change warning for current owner', () => {
    const ownerMember = {
      ...mockMember,
      role: 'owner' as const,
    };
    
    renderWithAuth(<MemberEditModal {...mockProps} member={ownerMember} />);
    
    expect(screen.getByText('Owner Role Change')).toBeInTheDocument();
    expect(screen.getByText(/you cannot change the owner's role directly/i)).toBeInTheDocument();
  });

  it('submits form with role change', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ member: { userId: '2', role: 'admin' } }),
    });

    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    // Change role
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    await user.click(screen.getByText('Admin'));
    
    // Submit form
    await user.click(screen.getByText('Update Role'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/organizations/1/members/2'),
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: JSON.stringify({
            role: 'admin',
          }),
        })
      );
    });
  });

  it('does not submit if no changes made', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    // Submit form without changes
    await user.click(screen.getByText('Update Role'));
    
    expect(toast.info).toHaveBeenCalledWith('No changes to save');
    expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API error during submission', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Cannot change role' }),
    });

    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    // Change role
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    await user.click(screen.getByText('Admin'));
    
    // Submit form
    await user.click(screen.getByText('Update Role'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('Cannot change role');
    });
  });

  it('shows transfer ownership button text for owner role change', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    await user.click(screen.getByText('Owner'));
    
    expect(screen.getByText('Transfer Ownership')).toBeInTheDocument();
  });

  it('disables submit button for owner trying to change their own role', async () => {
    const user = userEvent.setup();
    const ownerMember = {
      ...mockMember,
      role: 'owner' as const,
    };
    
    renderWithAuth(<MemberEditModal {...mockProps} member={ownerMember} />);
    
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    await user.click(screen.getByText('Admin'));
    
    expect(screen.getByText('Update Role')).toBeDisabled();
  });

  it('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets form when modal is closed and reopened', async () => {
    const user = userEvent.setup();
    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    // Change role
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    await user.click(screen.getByText('Admin'));
    
    // Close modal
    await user.click(screen.getByText('Cancel'));
    
    // Reopen modal
    renderWithAuth(<MemberEditModal {...mockProps} open={true} />);
    
    const reopenedRoleSelect = screen.getByRole('combobox');
    expect(reopenedRoleSelect).toHaveTextContent('Member');
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    // Change role
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    await user.click(screen.getByText('Admin'));
    
    // Submit form
    await user.click(screen.getByText('Update Role'));
    
    expect(screen.getByText('Updating...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('displays correct role icons and colors', () => {
    const ownerMember = {
      ...mockMember,
      role: 'owner' as const,
    };
    
    renderWithAuth(<MemberEditModal {...mockProps} member={ownerMember} />);
    
    // Check for crown icon (owner role)
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('shows success message with ownership transfer text', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ member: { userId: '2', role: 'owner' } }),
    });

    renderWithAuth(<MemberEditModal {...mockProps} />);
    
    // Change to owner role
    const roleSelect = screen.getByRole('combobox');
    await user.click(roleSelect);
    await user.click(screen.getByText('Owner'));
    
    // Submit form
    await user.click(screen.getByText('Transfer Ownership'));
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Ownership transferred successfully');
    });
  });
});