import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PersonnelRosterTable from './PersonnelRosterTable';
import * as usePersonnelHook from '../../hooks/usePersonnel';
import * as AuthContext from '../../contexts/AuthContext';

vi.mock('../../hooks/usePersonnel');
vi.mock('../../contexts/AuthContext');

describe('PersonnelRosterTable', () => {
  const mockPersonnel = [
    {
      id: '1',
      rosterId: 1,
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      rank: 'A1C',
      phoneNumber: '555-0123',
      squad: 'Alpha',
      flight: 'Flight A',
      detailEligible: true,
      role: 'user',
    },
    {
      id: '2',
      rosterId: 2,
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      rank: 'SrA',
      phoneNumber: '555-0124',
      squad: 'Bravo',
      flight: 'Flight B',
      detailEligible: true,
      role: 'admin',
    },
  ];

  const mockUpdatePersonnel = vi.fn();
  const mockDeletePersonnel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    AuthContext.useAuth = vi.fn(() => ({
      user: { uid: 'test-user', email: 'test@example.com' },
      isAdmin: true,
      loading: false,
    }));

    usePersonnelHook.usePersonnel = vi.fn(() => ({
      personnel: mockPersonnel,
      loading: false,
      error: null,
    }));

    usePersonnelHook.usePersonnelActions = vi.fn(() => ({
      updatePersonnel: mockUpdatePersonnel,
      deletePersonnel: mockDeletePersonnel,
    }));

    window.confirm = vi.fn(() => true);
  });

  it('should render personnel table with data', () => {
    render(<PersonnelRosterTable />);

    expect(screen.getByText('Personnel Roster (2)')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    usePersonnelHook.usePersonnel = vi.fn(() => ({
      personnel: [],
      loading: true,
      error: null,
    }));

    render(<PersonnelRosterTable />);

    expect(screen.getByText('Loading personnel...')).toBeInTheDocument();
  });

  it('should display error state', () => {
    usePersonnelHook.usePersonnel = vi.fn(() => ({
      personnel: [],
      loading: false,
      error: 'Failed to load',
    }));

    render(<PersonnelRosterTable />);

    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument();
  });

  it('should display empty state when no personnel', () => {
    usePersonnelHook.usePersonnel = vi.fn(() => ({
      personnel: [],
      loading: false,
      error: null,
    }));

    render(<PersonnelRosterTable />);

    expect(
      screen.getByText('No personnel records found. Import a CSV file to get started.')
    ).toBeInTheDocument();
  });

  it('should display role badges correctly', () => {
    render(<PersonnelRosterTable />);

    const userBadge = screen.getByTestId('role-badge-1');
    const adminBadge = screen.getByTestId('role-badge-2');

    expect(userBadge).toHaveTextContent('User');
    expect(adminBadge).toHaveTextContent('Admin');
  });

  it('should show role selector when badge is clicked', () => {
    render(<PersonnelRosterTable />);

    const userBadge = screen.getByTestId('role-badge-1');
    fireEvent.click(userBadge);

    expect(screen.getByTestId('role-select-1')).toBeInTheDocument();
  });

  it('should update role when selection changes', async () => {
    mockUpdatePersonnel.mockResolvedValueOnce();

    render(<PersonnelRosterTable />);

    const userBadge = screen.getByTestId('role-badge-1');
    fireEvent.click(userBadge);

    const select = screen.getByTestId('role-select-1');
    fireEvent.change(select, { target: { value: 'admin' } });

    await waitFor(() => {
      expect(mockUpdatePersonnel).toHaveBeenCalledWith('1', { role: 'admin' });
    });
  });

  it('should delete personnel when delete button is clicked', async () => {
    mockDeletePersonnel.mockResolvedValueOnce();

    render(<PersonnelRosterTable />);

    const deleteButton = screen.getByTestId('delete-button-1');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeletePersonnel).toHaveBeenCalledWith('1');
    });
  });

  it('should not delete if user cancels confirmation', async () => {
    window.confirm = vi.fn(() => false);

    render(<PersonnelRosterTable />);

    const deleteButton = screen.getByTestId('delete-button-1');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeletePersonnel).not.toHaveBeenCalled();
    });
  });

  it('should display RBAC note at bottom', () => {
    render(<PersonnelRosterTable />);

    expect(
      screen.getByText(/comprehensive Role-Based Access Control/i)
    ).toBeInTheDocument();
  });

  it('should display roster ID, rank, and flight', () => {
    render(<PersonnelRosterTable />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('A1C')).toBeInTheDocument();
    expect(screen.getByText('Flight A')).toBeInTheDocument();
  });

  it('should show dash for missing optional fields', () => {
    const personnelWithoutRank = [
      {
        id: '3',
        rosterId: 3,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        rank: '',
        flight: '',
        role: 'user',
      },
    ];

    usePersonnelHook.usePersonnel = vi.fn(() => ({
      personnel: personnelWithoutRank,
      loading: false,
      error: null,
    }));

    render(<PersonnelRosterTable />);

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
