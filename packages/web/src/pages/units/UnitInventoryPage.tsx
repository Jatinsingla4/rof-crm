import { Card, spacing } from '@rof-crm/design-system';

export function UnitInventoryPage() {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Units & Inventory</h1>
      <Card variant="elevated">
        <div style={{ padding: spacing.lg }}>Unit inventory grid will be displayed here</div>
      </Card>
    </div>
  );
}
