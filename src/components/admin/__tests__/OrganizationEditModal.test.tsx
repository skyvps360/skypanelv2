import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationEditModal } from '../OrganizationEditModal';
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
    organizationEdit: {
      name: {},
      slug: {},
      description: {},
    },
  },
}));

vi.mock('@/lib/errorHandling', () => ({
  handleApiError: vi.fn(),
  displaySuccess: vi.fn(),
  displayInfo: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock props and data

describe('OrganizationEditModal', () => {
  const mockOrganization = {
    id: '1',
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Test description',
    ownerId: '1',
    ownerName: 'John Doe',
    ownerEmail: 'john@test.com',
  };

  const mockProps = {
    organization: mockOrganization,
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

  it('renders modal when open with organization data', () => {
    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    expect(screen.getByText('Edit Organization')).toBeInTheDocument();
    expect(screen.getByText('Update organization details. The owner cannot be changed from this dialog.')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    renderWithAuth(<OrganizationEditModal {...mockProps} open={false} />);
    
    expect(screen.queryByText('Edit Organization')).not.toBeInTheDocument();
  });

  it('does not render modal when no organization provided', () => {
    renderWithAuth(<OrganizationEditModal {...mockProps} organization={null} />);
    
    expect(screen.queryByText('Edit Organization')).not.toBeInTheDocument();
  });

  it('pre-populates form with organization data', () => {
    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    expect(screen.getByDisplayValue('Test Organization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-organization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
  });

  it('displays current owner information', () => {
    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    expect(screen.getByText('Current Owner')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('updates form fields when user types', async () => {
    const user = userEvent.setup();
    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    const nameInput = screen.getByDisplayValue('Test Organization');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Organization');
    
    expect(nameInput).toHaveValue('Updated Organization');
  });

  it('submits form with changed data', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ organization: { id: '1', name: 'Updated Organization' } }),
    });

    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    // Update name
    const nameInput = screen.getByDisplayValue('Test Organization');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Organization');
    
    // Submit form
    await user.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/organizations/1'),
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          },
          body: JSON.stringify({
            name: 'Updated Organization',
          }),
        })
      );
    });
  });

  it('does not submit if no changes made', async () => {
    const user = userEvent.setup();
    const { displayInfo } = await import('@/lib/errorHandling');
    
    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    // Submit form without changes
    await user.click(screen.getByText('Save Changes'));
    
    expect(displayInfo).toHaveBeenCalledWith('No changes to save');
    expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API error during submission', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Organization name already exists' }),
    });

    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    // Update name
    const nameInput = screen.getByDisplayValue('Test Organization');
    await user.clear(nameInput);
    await user.type(nameInput, 'Existing Organization');
    
    // Submit form
    await user.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets form when modal is closed and reopened', async () => {
    const user = userEvent.setup();
    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    // Modify form
    const nameInput = screen.getByDisplayValue('Test Organization');
    await user.clear(nameInput);
    await user.type(nameInput, 'Modified Name');
    
    // Close modal
    await user.click(screen.getByText('Cancel'));
    
    // Reopen modal
    renderWithAuth(<OrganizationEditModal {...mockProps} open={true} />);
    
    expect(screen.getByDisplayValue('Test Organization')).toBeInTheDocument();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    // Update name
    const nameInput = screen.getByDisplayValue('Test Organization');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Organization');
    
    // Submit form
    await user.click(screen.getByText('Save Changes'));
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('handles organization with no description', () => {
    const orgWithoutDescription = {
      ...mockOrganization,
      description: undefined,
    };
    
    renderWithAuth(<OrganizationEditModal {...mockProps} organization={orgWithoutDescription} />);
    
    const descriptionField = screen.getByLabelText(/description/i);
    expect(descriptionField).toHaveValue('');
  });

  it('only sends changed fields in update request', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ organization: { id: '1' } }),
    });

    renderWithAuth(<OrganizationEditModal {...mockProps} />);
    
    // Only update description
    const descriptionInput = screen.getByDisplayValue('Test description');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Updated description');
    
    // Submit form
    await user.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/organizations/1'),
        expect.objectContaining({
          body: JSON.stringify({
            description: 'Updated description',
          }),
        })
      );
    });
  });
});