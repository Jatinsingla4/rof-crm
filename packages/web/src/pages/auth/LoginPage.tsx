import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button, Card } from '@rof-crm/design-system';
import { spacing, colors } from '@rof-crm/design-system';

/**
 * Login Page
 * Email + password authentication
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Call API endpoint /api/auth/login
      // const response = await apiClient.post('/auth/login', { email, password });
      // const { user, token, permissions } = response.data;
      // setAuth(user, token, permissions);

      // Mock login for now
      const mockUser = {
        id: '1',
        email,
        name: email.split('@')[0],
        role: 'super_admin',
        projectIds: ['proj-001', 'proj-002', 'proj-003']
      };
      const mockToken = 'mock-jwt-token';
      setAuth(mockUser, mockToken, [
        // Consumer permissions
        'view_consumers', 'create_consumers', 'edit_consumers', 'delete_consumers',
        // Unit permissions
        'view_units', 'create_units', 'edit_units', 'delete_units',
        // Allotment permissions
        'view_allotments', 'create_allotments', 'edit_allotments', 'cancel_allotments',
        // Payment permissions
        'view_payments', 'record_payments', 'view_overdue', 'calculate_interest',
        // Document permissions
        'view_documents', 'generate_documents', 'upload_documents', 'delete_documents',
        // Communication permissions
        'view_communications', 'send_email', 'send_whatsapp', 'send_sms',
        // Report permissions
        'view_reports', 'export_reports',
        // RBAC permissions
        'manage_users', 'manage_roles', 'view_audit_logs',
      ]);

      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: colors.neutral[50],
      }}
    >
      <Card variant="elevated" style={{ width: '400px' }}>
        <div style={{ padding: spacing.lg }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg, textAlign: 'center' }}>
            ROF CRM
          </h1>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[400]}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[400]}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            <Button variant="primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p style={{ marginTop: spacing.lg, fontSize: '12px', color: colors.neutral[600], textAlign: 'center' }}>
            Demo: Use any email and password to login
          </p>
        </div>
      </Card>
    </div>
  );
}
