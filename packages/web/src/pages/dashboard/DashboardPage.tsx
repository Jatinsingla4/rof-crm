import { Card, colors, spacing } from '@rof-crm/design-system';

/**
 * Dashboard Page
 * Displays key metrics and charts
 * Sales Dashboard + Financial Dashboard + Project Dashboard
 */
export function DashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Dashboard</h1>

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        <Card variant="elevated" padding="spacious">
          <div style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: '8px' }}>
            Total Applications
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>1,248</div>
          <div style={{ fontSize: '14px', color: colors.success[500] }}>↑ 12% vs last month</div>
        </Card>

        <Card variant="elevated" padding="spacious">
          <div style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: '8px' }}>
            Allotted Units
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>487</div>
          <div style={{ fontSize: '14px', color: colors.neutral[600] }}>39% of total</div>
        </Card>

        <Card variant="elevated" padding="spacious">
          <div style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: '8px' }}>
            Outstanding Amount
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>₹4.2Cr</div>
          <div style={{ fontSize: '14px', color: colors.warning[500] }}>↓ 5% collections</div>
        </Card>

        <Card variant="elevated" padding="spacious">
          <div style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: '8px' }}>
            Overdue Amount
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>₹42L</div>
          <div style={{ fontSize: '14px', color: colors.error[500] }}>58 customers</div>
        </Card>
      </div>

      {/* Charts placeholder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
        <Card variant="elevated">
          <div style={{ padding: spacing.md }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.md }}>
              Pipeline Funnel
            </h3>
            <div style={{ height: '300px', background: colors.neutral[100], borderRadius: '8px' }}>
              {/* Chart will be rendered here */}
            </div>
          </div>
        </Card>

        <Card variant="elevated">
          <div style={{ padding: spacing.md }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.md }}>
              Collection Efficiency
            </h3>
            <div style={{ height: '300px', background: colors.neutral[100], borderRadius: '8px' }}>
              {/* Chart will be rendered here */}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
