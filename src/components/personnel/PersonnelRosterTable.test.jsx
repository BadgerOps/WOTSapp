import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PersonnelRosterTable from './PersonnelRosterTable';
import * as usePersonnelHook from '../../hooks/usePersonnel';
import * as AuthContext from '../../contexts/AuthContext';

vi.mock('../../hooks/usePersonnel');
vi.mock('../../contexts/AuthContext');

// Mock PersonnelEditModal to avoid rendering issues
vi.mock('./PersonnelEditModal', () => ({
  default: ({ person, onClose }) => (
    <div data-testid="edit-modal">
      Editing {person.firstName} {person.lastName}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe('PersonnelRosterTable', () => {
  const mockPersonnel = [
    {
      id: '1',
      rosterId: 1,
      email: 'user6@example.com',
      firstName: 'John',
      lastName: 'Doe',
      rank: 'A1C',
      phoneNumber: '555-0100',
      class: '26-01',
      flight: 'Barrow',
      detailEligible: true,
      cqEligible: true,
    },
    {
      id: '2',
      rosterId: 2,
      email: 'user4@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      rank: 'SrA',
      phoneNumber: '555-0101',
      class: '26-02',
      flight: 'Long',
      detailEligible: true,
      cqEligible: false,
    },
  ];

  const mockUpdatePersonnel = vi.fn();
  const mockDeletePersonnel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    AuthContext.useAuth = vi.fn(() => ({
      user: { uid: 'test-user', email: 'user11@example.com' },
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

    expect(screen.getByText('Personnel Roster (2 of 2)')).toBeInTheDocument();
    // Name format is "Last, First"
    expect(screen.getByText('Doe, John')).toBeInTheDocument();
    expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
    expect(screen.getByText('user6@example.com')).toBeInTheDocument();
    expect(screen.getByText('user4@example.com')).toBeInTheDocument();
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

  it('should have Edit buttons for each person', () => {
    render(<PersonnelRosterTable />);

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons).toHaveLength(2);
  });

  it('should open edit modal when Edit is clicked', () => {
    render(<PersonnelRosterTable />);

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
    expect(screen.getByText('Editing John Doe')).toBeInTheDocument();
  });

  it('should toggle detailEligible when toggle button is clicked', async () => {
    mockUpdatePersonnel.mockResolvedValueOnce();

    render(<PersonnelRosterTable />);

    // First person has detailEligible: true, find the toggle buttons
    // The table has Detail and CQ columns with toggle buttons
    const toggleButtons = screen.getAllByTitle(/Detail Eligible|CQ Eligible/i);
    // Click the first Detail toggle (should toggle off)
    const detailToggle = screen.getAllByTitle('Detail Eligible - Click to toggle')[0];
    fireEvent.click(detailToggle);

    await waitFor(() => {
      expect(mockUpdatePersonnel).toHaveBeenCalledWith('1', { detailEligible: false });
    });
  });

  it('should toggle cqEligible when toggle button is clicked', async () => {
    mockUpdatePersonnel.mockResolvedValueOnce();

    render(<PersonnelRosterTable />);

    // Second person has cqEligible: false
    const cqToggle = screen.getAllByTitle('Not CQ Eligible - Click to toggle')[0];
    fireEvent.click(cqToggle);

    await waitFor(() => {
      expect(mockUpdatePersonnel).toHaveBeenCalledWith('2', { cqEligible: true });
    });
  });

  it('should delete personnel when delete button is clicked', async () => {
    mockDeletePersonnel.mockResolvedValueOnce();

    render(<PersonnelRosterTable />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeletePersonnel).toHaveBeenCalledWith('1');
    });
  });

  it('should not delete if user cancels confirmation', async () => {
    window.confirm = vi.fn(() => false);

    render(<PersonnelRosterTable />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeletePersonnel).not.toHaveBeenCalled();
    });
  });

  it('should display roster ID, rank, class, and flight', () => {
    render(<PersonnelRosterTable />);

    expect(screen.getByText('1')).toBeInTheDocument();
    // Rank appears in both table cell and inline mobile display, so use getAllByText
    expect(screen.getAllByText('A1C').length).toBeGreaterThanOrEqual(1);
    // Classes appear both in table cells and filter dropdown, so use getAllByText
    expect(screen.getAllByText('26-01').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Barrow').length).toBeGreaterThanOrEqual(1);
  });

  it('should show dash for missing optional fields', () => {
    const personnelWithoutOptional = [
      {
        id: '3',
        rosterId: 3,
        email: 'user11@example.com',
        firstName: 'Test',
        lastName: 'User',
        rank: '',
        phoneNumber: '',
        class: '',
        flight: '',
        detailEligible: false,
        cqEligible: false,
      },
    ];

    usePersonnelHook.usePersonnel = vi.fn(() => ({
      personnel: personnelWithoutOptional,
      loading: false,
      error: null,
    }));

    render(<PersonnelRosterTable />);

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by search term', () => {
    render(<PersonnelRosterTable />);

    const searchInput = screen.getByPlaceholderText('Search by name, email, or rank...');
    fireEvent.change(searchInput, { target: { value: 'john' } });

    expect(screen.getByText('Personnel Roster (1 of 2)')).toBeInTheDocument();
    expect(screen.getByText('Doe, John')).toBeInTheDocument();
    expect(screen.queryByText('Smith, Jane')).not.toBeInTheDocument();
  });

  it('should show class and flight filter dropdowns', () => {
    render(<PersonnelRosterTable />);

    expect(screen.getByText('All Classes')).toBeInTheDocument();
    expect(screen.getByText('All Flights')).toBeInTheDocument();
  });

  it('should filter by class', () => {
    render(<PersonnelRosterTable />);

    const classSelect = screen.getByDisplayValue('All Classes');
    fireEvent.change(classSelect, { target: { value: '26-01' } });

    expect(screen.getByText('Personnel Roster (1 of 2)')).toBeInTheDocument();
    expect(screen.getByText('Doe, John')).toBeInTheDocument();
    expect(screen.queryByText('Smith, Jane')).not.toBeInTheDocument();
  });

  it('should filter by flight', () => {
    render(<PersonnelRosterTable />);

    const flightSelect = screen.getByDisplayValue('All Flights');
    fireEvent.change(flightSelect, { target: { value: 'Long' } });

    expect(screen.getByText('Personnel Roster (1 of 2)')).toBeInTheDocument();
    expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
    expect(screen.queryByText('Doe, John')).not.toBeInTheDocument();
  });

  it('should show "Linked" indicator for personnel with userId', () => {
    const personnelWithLink = [
      {
        id: '1',
        rosterId: 1,
        email: 'user6@example.com',
        firstName: 'John',
        lastName: 'Doe',
        rank: 'A1C',
        class: '26-01',
        flight: 'Barrow',
        detailEligible: true,
        cqEligible: true,
        userId: 'user-123',
      },
    ];

    usePersonnelHook.usePersonnel = vi.fn(() => ({
      personnel: personnelWithLink,
      loading: false,
      error: null,
    }));

    render(<PersonnelRosterTable />);

    expect(screen.getByText('Linked')).toBeInTheDocument();
  });
});
