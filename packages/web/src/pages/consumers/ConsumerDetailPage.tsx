import { useParams } from 'react-router-dom';
import { Card, spacing } from '@rof-crm/design-system';

/**
 * Consumer Detail Page
 * Shows 360° profile: personal info, KYC, payments, remarks, documents
 */
export function ConsumerDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>
        Consumer Details
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing.lg }}>
        {/* Main Profile Card */}
        <Card variant="elevated">
          <div style={{ padding: spacing.md }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: spacing.md }}>
              Profile Information
            </h3>
            <p>Consumer ID: {id}</p>
            <p style={{ marginTop: spacing.sm }}>Loading consumer details...</p>
          </div>
        </Card>

        {/* Sidebar */}
        <div>
          <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
            <div style={{ padding: spacing.md }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                Payment Summary
              </h4>
              <p style={{ fontSize: '12px', color: '#595959' }}>Total Due: ₹0</p>
              <p style={{ fontSize: '12px', color: '#595959' }}>Collected: ₹0</p>
              <p style={{ fontSize: '12px', color: '#595959' }}>Outstanding: ₹0</p>
            </div>
          </Card>

          <Card variant="elevated">
            <div style={{ padding: spacing.md }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                Quick Actions
              </h4>
              <button
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  background: '#722ED1',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  marginBottom: spacing.xs,
                  cursor: 'pointer',
                }}
              >
                Record Payment
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
