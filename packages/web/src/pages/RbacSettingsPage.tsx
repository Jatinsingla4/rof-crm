import React, { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useRoles, useAuditLogs, useUserActivity } from '../hooks';
import { Button, Card, DataTable, LoadingSkeleton, Modal } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

const ROLES = ['super_admin', 'project_manager', 'sales_executive', 'accounts_finance', 'support_agent', 'read_only_viewer'];

export function RbacSettingsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);

  // Fetch data
  const { data: users, isLoading: usersLoading } = useUsers({ pageSize: 100 });
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: auditLogs, isLoading: auditLoading } = useAuditLogs({ pageSize: 50 });
  const { data: userActivity, isLoading: activityLoading } = useUserActivity();

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const handleCreateUser = async (data: any) => {
    try {
      await createUserMutation.mutateAsync(data);
      setShowCreateUserForm(false);
    } catch (err) {
      console.error('Failed to create user:', err);
    }
  };

  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      await updateUserMutation.mutateAsync({ id: userId, data });
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const userColumns = [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'email', header: 'Email', accessorKey: 'email' },
    { id: 'mobile', header: 'Mobile', accessorKey: 'mobile' },
    {
      id: 'role',
      header: 'Role',
      accessorKey: 'role',
      cell: (value: string) => (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: colors.primary[50],
            color: colors.primary[700],
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {value.replace(/_/g, ' ').toUpperCase()}
        </span>
      ),
    },
    {
      id: 'isActive',
      header: 'Status',
      accessorKey: 'is_active',
      cell: (value: boolean) => (
        <span
          style={{
            color: value ? colors.success[600] : colors.error[600],
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          {value ? '🟢 Active' : '🔴 Inactive'}
        </span>
      ),
    },
  ];

  const auditColumns = [
    { id: 'user', header: 'User', accessorKey: 'user_id' },
    { id: 'action', header: 'Action', accessorKey: 'action' },
    { id: 'entityType', header: 'Entity', accessorKey: 'entity_type' },
    {
      id: 'timestamp',
      header: 'When',
      accessorKey: 'timestamp',
      cell: (value: string) => new Date(value).toLocaleDateString('en-IN'),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0 }}>RBAC & Settings</h1>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          marginBottom: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[200]}`,
        }}
      >
        {(['users', 'roles', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: `${spacing.md} ${spacing.lg}`,
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === tab ? `2px solid ${colors.primary[600]}` : 'none',
              color: activeTab === tab ? colors.primary[600] : colors.neutral[600],
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {tab === 'users' && 'Users'}
            {tab === 'roles' && 'Roles'}
            {tab === 'audit' && 'Audit Logs'}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          <div style={{ marginBottom: spacing.lg }}>
            <Button variant="primary" onClick={() => setShowCreateUserForm(true)}>
              Add User
            </Button>
          </div>

          {usersLoading ? (
            <LoadingSkeleton height={400} />
          ) : users && users.length > 0 ? (
            <Card>
              <DataTable columns={userColumns} data={users} selectable sortable />
            </Card>
          ) : (
            <Card>
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
                No users found
              </div>
            </Card>
          )}

          {showCreateUserForm && (
            <UserCreateForm
              onSubmit={handleCreateUser}
              onCancel={() => setShowCreateUserForm(false)}
              isLoading={createUserMutation.isPending}
            />
          )}
        </>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <>
          {rolesLoading ? (
            <LoadingSkeleton height={400} />
          ) : roles ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: spacing.lg,
              }}
            >
              {Object.entries(roles).map(([roleName, roleConfig]: [string, any]) => (
                <Card key={roleName}>
                  <h3 style={{ marginTop: 0, color: colors.primary[600] }}>
                    {roleName.replace(/_/g, ' ').toUpperCase()}
                  </h3>
                  <div style={{ marginBottom: spacing.md }}>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], fontWeight: 600 }}>
                      Modules Access:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                      {roleConfig.modules.map((module: string) => (
                        <span
                          key={module}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            backgroundColor: colors.primary[100],
                            color: colors.primary[700],
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Module {module}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: spacing.md }}>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], fontWeight: 600 }}>
                      Actions:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                      {roleConfig.actions.map((action: string) => (
                        <span
                          key={action}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            backgroundColor: colors.success[100],
                            color: colors.success[700],
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {action.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], fontWeight: 600 }}>
                      Scoping:
                    </div>
                    <div style={{ fontSize: '13px', marginTop: spacing.sm }}>
                      {roleConfig.projectScoping ? '✓ Project-scoped' : '✗ Global access'}
                      {roleConfig.scopedTo && (
                        <div>Scoped to: {roleConfig.scopedTo.replace(/_/g, ' ')}</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <>
          {auditLoading ? (
            <LoadingSkeleton height={400} />
          ) : auditLogs && auditLogs.length > 0 ? (
            <Card>
              <h2>Audit Log</h2>
              <div style={{ fontSize: '12px', color: colors.neutral[600], marginBottom: spacing.lg }}>
                System-wide activity log. Immutable, 1-year retention.
              </div>
              <DataTable columns={auditColumns} data={auditLogs} sortable pagination={{ page: 1, pageSize: 20 }} />
            </Card>
          ) : (
            <Card>
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
                No audit logs
              </div>
            </Card>
          )}

          {userActivity && userActivity.length > 0 && (
            <Card style={{ marginTop: spacing.lg }}>
              <h2>User Activity Summary</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                      <th style={{ textAlign: 'left', padding: spacing.md }}>User</th>
                      <th style={{ textAlign: 'right', padding: spacing.md }}>Actions</th>
                      <th style={{ textAlign: 'right', padding: spacing.md }}>Active Days</th>
                      <th style={{ textAlign: 'left', padding: spacing.md }}>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userActivity.map((activity: any) => (
                      <tr key={activity.user_id} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                        <td style={{ padding: spacing.md }}>{activity.user_id}</td>
                        <td style={{ textAlign: 'right', padding: spacing.md }}>{activity.action_count}</td>
                        <td style={{ textAlign: 'right', padding: spacing.md }}>{activity.active_days}</td>
                        <td style={{ padding: spacing.md }}>
                          {new Date(activity.last_activity).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

interface UserCreateFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function UserCreateForm({ onSubmit, onCancel, isLoading }: UserCreateFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    role: 'sales_executive',
    assignedProjectIds: [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        style={{
          width: '90%',
          maxWidth: 500,
          padding: spacing.lg,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Add User</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label>Name*</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{
                width: '100%',
                padding: spacing.md,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Email*</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              style={{
                width: '100%',
                padding: spacing.md,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Mobile</label>
            <input
              type="tel"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              style={{
                width: '100%',
                padding: spacing.md,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Role*</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              style={{
                width: '100%',
                padding: spacing.md,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
