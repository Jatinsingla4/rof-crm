import { Card, spacing } from '@rof-crm/design-system';

export function DocumentVaultPage() {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Document Vault</h1>
      <Card variant="elevated">
        <div style={{ padding: spacing.lg }}>Document vault will be displayed here</div>
      </Card>
    </div>
  );
}
