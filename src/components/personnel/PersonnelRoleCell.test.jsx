import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonnelRoleCell from './PersonnelRoleCell';
import { ROLES } from '../../lib/roles';

describe('PersonnelRoleCell', () => {
  const mockOnRoleChange = vi.fn();

  const defaultPerson = {
    id: 'person-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    role: ROLES.USER,
    userId: 'user-456',
  };

  beforeEach(() => {
    mockOnRoleChange.mockReset();
    mockOnRoleChange.mockResolvedValue(undefined);
  });

  describe('rendering', () => {
    it('renders User badge for user role', () => {
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('renders Uniform Admin badge for uniform_admin role', () => {
      const person = { ...defaultPerson, role: ROLES.UNIFORM_ADMIN };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);
      expect(screen.getByText('Uniform Admin')).toBeInTheDocument();
    });

    it('renders Admin badge for admin role', () => {
      const person = { ...defaultPerson, role: ROLES.ADMIN };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('defaults to User role when role is undefined', () => {
      const person = { ...defaultPerson, role: undefined };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('defaults to User role when role is null', () => {
      const person = { ...defaultPerson, role: null };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('applies gray color class for user role', () => {
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveClass('bg-gray-100');
      expect(badge).toHaveClass('text-gray-700');
    });

    it('applies blue color class for uniform_admin role', () => {
      const person = { ...defaultPerson, role: ROLES.UNIFORM_ADMIN };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveClass('text-blue-700');
    });

    it('applies purple color class for admin role', () => {
      const person = { ...defaultPerson, role: ROLES.ADMIN };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveClass('bg-purple-100');
      expect(badge).toHaveClass('text-purple-700');
    });
  });

  describe('disabled state', () => {
    it('shows cursor-not-allowed when disabled', () => {
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} disabled />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveClass('cursor-not-allowed');
    });

    it('does not open dropdown when clicked while disabled', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} disabled />);

      await user.click(screen.getByRole('button'));
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('shows correct title when disabled', () => {
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} disabled />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveAttribute('title', 'Only admins can change roles');
    });

    it('shows editable title when not disabled', () => {
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveAttribute('title', expect.stringContaining('Click to change role'));
    });
  });

  describe('editing behavior', () => {
    it('opens dropdown when badge is clicked', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows all role options in dropdown', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      const options = screen.getAllByRole('option');

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('User');
      expect(options[1]).toHaveTextContent('Uniform Admin');
      expect(options[2]).toHaveTextContent('Candidate Leadership');
      expect(options[3]).toHaveTextContent('Admin');
    });

    it('has current role selected in dropdown', async () => {
      const user = userEvent.setup();
      const person = { ...defaultPerson, role: ROLES.UNIFORM_ADMIN };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue(ROLES.UNIFORM_ADMIN);
    });

    it('closes dropdown on escape key', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('closes dropdown on blur when not loading', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />
          <button data-testid="other-button">Other</button>
        </div>
      );

      await user.click(screen.getByRole('button', { name: /role/i }));
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      fireEvent.blur(screen.getByRole('combobox'));
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('role change', () => {
    it('calls onRoleChange with correct arguments when role is changed', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      await user.selectOptions(screen.getByRole('combobox'), ROLES.ADMIN);

      await waitFor(() => {
        expect(mockOnRoleChange).toHaveBeenCalledWith(
          'person-123',
          ROLES.ADMIN,
          'user-456'
        );
      });
    });

    it('passes undefined userId when person has no linked user', async () => {
      const user = userEvent.setup();
      const person = { ...defaultPerson, userId: undefined };
      render(<PersonnelRoleCell person={person} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      await user.selectOptions(screen.getByRole('combobox'), ROLES.ADMIN);

      await waitFor(() => {
        expect(mockOnRoleChange).toHaveBeenCalledWith(
          'person-123',
          ROLES.ADMIN,
          undefined
        );
      });
    });

    it('does not call onRoleChange when same role is selected', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      // Select the same role that's already selected
      await user.selectOptions(screen.getByRole('combobox'), ROLES.USER);

      expect(mockOnRoleChange).not.toHaveBeenCalled();
    });

    it('closes dropdown after successful role change', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      await user.selectOptions(screen.getByRole('combobox'), ROLES.ADMIN);

      await waitFor(() => {
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      });
    });

    it('keeps dropdown open on error', async () => {
      mockOnRoleChange.mockRejectedValueOnce(new Error('Update failed'));
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      await user.selectOptions(screen.getByRole('combobox'), ROLES.ADMIN);

      // Dropdown should still be visible after error
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('disables dropdown during loading', async () => {
      // Make the mock hang to simulate loading
      mockOnRoleChange.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      await user.selectOptions(screen.getByRole('combobox'), ROLES.ADMIN);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeDisabled();
      });
    });
  });

  describe('accessibility', () => {
    it('has accessible label for badge button', () => {
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Role:'));
    });

    it('has accessible label for dropdown', async () => {
      const user = userEvent.setup();
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} />);

      await user.click(screen.getByRole('button'));
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Select role');
    });

    it('indicates read-only state in aria-label when disabled', () => {
      render(<PersonnelRoleCell person={defaultPerson} onRoleChange={mockOnRoleChange} disabled />);
      const badge = screen.getByRole('button');
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('read-only'));
    });
  });
});
