import { Card, spacing } from '@rof-crm/design-system';

/**
 * Consumer List Page
 * Shows all consumers with advanced search + filter
 * Displays: name, mobile, email, lead stage, unit, outstanding amount
 */
export function ConsumerListPage() {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Consumers</h1>

      {/* Search + Filter */}
      <Card variant="outlined" padding="standard" style={{ marginBottom: spacing.lg }}>
        <div style={{ display: 'flex', gap: spacing.md }}>
          <input
            type="text"
            placeholder="Search by name, mobile, Aadhaar, application ID..."
            style={{
              flex: 1,
              padding: spacing.sm,
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              fontSize: '14px',
            }}
          />
          <button
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              background: '#1890FF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Search
          </button>
        </div>
      </Card>

      {/* Data table placeholder */}
      <Card variant="elevated">
        <div style={{ padding: spacing.md }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid #f0f0f0` }}>
                <th style={{ textAlign: 'left', padding: spacing.sm, fontWeight: 600 }}>Name</th>
                <th style={{ textAlign: 'left', padding: spacing.sm, fontWeight: 600 }}>Mobile</th>
                <th style={{ textAlign: 'left', padding: spacing.sm, fontWeight: 600 }}>Lead Stage</th>
                <th style={{ textAlign: 'left', padding: spacing.sm, fontWeight: 600 }}>Unit</th>
                <th style={{ textAlign: 'left', padding: spacing.sm, fontWeight: 600 }}>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid #f0f0f0`, height: '40px' }}>
                <td style={{ padding: spacing.sm }}>Loading...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
