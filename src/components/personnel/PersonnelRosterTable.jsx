import { useState } from 'react';
import { usePersonnel, usePersonnelActions } from '../../hooks/usePersonnel';
import { useAuth } from '../../contexts/AuthContext';

export default function PersonnelRosterTable() {
  const { user } = useAuth();
  const { personnel, loading, error } = usePersonnel();
  const { updatePersonnel, deletePersonnel } = usePersonnelActions();
  const [editingRole, setEditingRole] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [linkingAccount, setLinkingAccount] = useState(false);

  async function handleRoleChange(person, newRole) {
    setUpdatingId(person.id);
    try {
      await updatePersonnel(person.id, { role: newRole });
      setEditingRole(null);
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(personId) {
    if (!confirm('Are you sure you want to delete this personnel record?')) {
      return;
    }

    try {
      await deletePersonnel(personId);
    } catch (err) {
      console.error('Error deleting personnel:', err);
    }
  }

  async function handleLinkMyAccount(person) {
    if (!user) return;

    if (!confirm(`Link your Firebase account to ${person.firstName} ${person.lastName}?`)) {
      return;
    }

    setLinkingAccount(true);
    try {
      await updatePersonnel(person.id, { userId: user.uid });
      alert('Account linked successfully! You can now see your assigned details.');
    } catch (err) {
      console.error('Error linking account:', err);
      alert('Failed to link account: ' + err.message);
    } finally {
      setLinkingAccount(false);
    }
  }

  function getRoleBadgeColor(role) {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'uniform_admin':
        return 'bg-blue-100 text-blue-800';
      case 'user':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getRoleLabel(role) {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'uniform_admin':
        return 'Uniform Admin';
      case 'user':
      default:
        return 'User';
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-center text-gray-600">Loading personnel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (personnel.length === 0) {
    return (
      <div className="card">
        <div className="text-center text-gray-600">
          No personnel records found. Import a CSV file to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Personnel Roster ({personnel.length})
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Roster ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Flight
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {personnel.map((person) => (
              <tr key={person.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {person.rosterId}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {person.firstName} {person.lastName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {person.email}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {person.rank || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {person.flight || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  {editingRole === person.id ? (
                    <select
                      value={person.role || 'user'}
                      onChange={(e) => handleRoleChange(person, e.target.value)}
                      disabled={updatingId === person.id}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                      data-testid={`role-select-${person.id}`}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="uniform_admin">Uniform Admin</option>
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingRole(person.id)}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        person.role || 'user'
                      )}`}
                      data-testid={`role-badge-${person.id}`}
                    >
                      {getRoleLabel(person.role || 'user')}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className="flex gap-2">
                    {!person.userId && user && person.email === user.email && (
                      <button
                        onClick={() => handleLinkMyAccount(person)}
                        disabled={linkingAccount}
                        className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                      >
                        {linkingAccount ? 'Linking...' : 'Link My Account'}
                      </button>
                    )}
                    {person.userId && (
                      <span className="text-xs text-green-600" title={`Linked to: ${person.userId}`}>
                        ✓ Linked
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(person.id)}
                      className="text-red-600 hover:text-red-700"
                      data-testid={`delete-button-${person.id}`}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>Note:</strong> A comprehensive Role-Based Access Control (RBAC) system
          should be implemented in the future to provide granular permissions and better
          security management.
        </p>
      </div>
    </div>
  );
}
