import { Card, spacing } from '@rof-crm/design-system';

export function CommunicationsPage() {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Communications</h1>
      <Card variant="elevated">
        <div style={{ padding: spacing.lg }}>Communications panel will be displayed here</div>
      </Card>
    </div>
  );
}
