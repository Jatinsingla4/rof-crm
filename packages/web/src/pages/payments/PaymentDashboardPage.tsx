import { Card, spacing } from '@rof-crm/design-system';

export function PaymentDashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Payments</h1>
      <Card variant="elevated">
        <div style={{ padding: spacing.lg }}>Payment dashboard will be displayed here</div>
      </Card>
    </div>
  );
}
