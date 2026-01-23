import { useState } from 'react';
import { ROLES, ROLE_INFO, ROLE_HIERARCHY } from '../../lib/roles';

/**
 * PersonnelRoleCell - Displays and allows editing of a personnel member's role
 *
 * Features:
 * - Color-coded badge display (gray=User, blue=Uniform Admin, purple=Admin)
 * - Inline dropdown editing when clicked (if not disabled)
 * - Loading state during role update
 * - Accessible with keyboard navigation
 */
export default function PersonnelRoleCell({ person, onRoleChange, disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentRole = person.role || ROLES.USER;
  const roleInfo = ROLE_INFO[currentRole] || ROLE_INFO[ROLES.USER];

  async function handleChange(e) {
    const newRole = e.target.value;
    if (newRole === currentRole) {
      setEditing(false);
      return;
    }

    setLoading(true);
    try {
      await onRoleChange(person.id, newRole, person.userId);
      setEditing(false);
    } catch (err) {
      console.error('Error changing role:', err);
      // Keep editing open on error so user can retry
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setEditing(false);
    }
  }

  // Color classes for each role
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  };

  if (editing) {
    return (
      <select
        value={currentRole}
        onChange={handleChange}
        onBlur={() => !loading && setEditing(false)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        autoFocus
        className={`text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          loading ? 'opacity-50 cursor-wait' : ''
        }`}
        aria-label="Select role"
      >
        {ROLE_HIERARCHY.map((role) => {
          const info = ROLE_INFO[role];
          return (
            <option key={role} value={role}>
              {info.label}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <button
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full transition-colors ${
        colorClasses[roleInfo.color] || colorClasses.gray
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500'}`}
      title={disabled ? 'Only admins can change roles' : `Click to change role (${roleInfo.description})`}
      aria-label={`Role: ${roleInfo.label}${disabled ? ' (read-only)' : ', click to edit'}`}
    >
      {roleInfo.label}
    </button>
  );
}
