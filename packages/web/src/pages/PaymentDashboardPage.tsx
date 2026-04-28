import { useState } from 'react';
import { usePaymentDashboard, useOverduePayments, useRecordReceipt } from '../hooks';
import { DashboardKPICard, DataTable, Button, Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

export function PaymentDashboardPage({ projectId }: { projectId: string }) {
  const [showReceiptForm, setShowReceiptForm] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading, error: dashboardError } = usePaymentDashboard(projectId);
  const { data: overduePayments, isLoading: overdueLoading, error: overdueError } = useOverduePayments();
  const recordReceiptMutation = useRecordReceipt();

  const overdueColumns = [
    { key: 'consumer_name', header: 'Consumer Name', render: (item: any) => item.consumer_name },
    { key: 'mobile', header: 'Mobile', render: (item: any) => item.mobile },
    { key: 'amount_due_inr', header: 'Amount Due (₹)', render: (item: any) => `₹${item.amount_due_inr?.toLocaleString('en-IN') || 0}` },
    { key: 'days_overdue', header: 'Days Overdue', render: (item: any) => item.days_overdue },
    { key: 'penalInterestInr', header: 'Penal Interest (₹)', render: (item: any) => `₹${item.penalInterestInr?.toLocaleString('en-IN') || 0}` },
  ];

  const handleRecordReceipt = async (data: any) => {
    try {
      await recordReceiptMutation.mutateAsync(data);
      setShowReceiptForm(false);
    } catch (err) {
      console.error('Failed to record receipt:', err);
    }
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0 }}>Payment Dashboard</h1>

      {/* KPI Cards */}
      {dashboardLoading ? (
        <LoadingSkeleton height={150} />
      ) : dashboardError ? (
        <Card style={{ background: '#FFF1F0', border: '1px solid #FFCCC7' }}>
          <div style={{ padding: spacing.lg, color: '#820014' }}>
            Error loading payment dashboard. Please try again.
          </div>
        </Card>
      ) : dashboard ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <DashboardKPICard
            metric={`₹${(dashboard.totalReceivables / 100000).toFixed(1)}L`}
            title="Total Receivables"
            icon="💰"
            variant="primary"
          />
          <DashboardKPICard
            metric={`₹${(dashboard.totalCollected / 100000).toFixed(1)}L`}
            title="Total Collected"
            icon="✅"
            variant="success"
            trend={{
              value: dashboard.collectionPercentage,
              direction: 'up',
            }}
          />
          <DashboardKPICard
            metric={`${dashboard.collectionPercentage}%`}
            title="Collection Rate"
            icon="📊"
            variant="primary"
          />
          <DashboardKPICard
            metric={`₹${(dashboard.outstanding / 100000).toFixed(1)}L`}
            title="Outstanding"
            icon="⚠️"
            variant={dashboard.outstanding > dashboard.totalReceivables * 0.3 ? 'error' : 'warning'}
          />
          <DashboardKPICard
            metric={dashboard.overdueCount}
            title="Overdue Demands"
            icon="🔴"
            variant="error"
          />
        </div>
      ) : (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No payment data available
          </div>
        </Card>
      )}

      {/* Record Receipt Button */}
      <div style={{ marginBottom: spacing.lg }}>
        <Button variant="primary" onClick={() => setShowReceiptForm(true)}>
          Record Receipt
        </Button>
      </div>

      {/* Overdue Payments Section */}
      <Card>
        <h2 style={{ marginTop: 0 }}>Overdue Payments (HRERA Rule 15)</h2>
        {overdueLoading ? (
          <LoadingSkeleton height={300} />
        ) : overdueError ? (
          <div style={{ padding: spacing.lg, background: '#FFF1F0', color: '#820014', borderRadius: '4px' }}>
            Error loading overdue payments. Please try again.
          </div>
        ) : (overduePayments || []).length > 0 ? (
          <div>
            <div style={{ marginBottom: spacing.md, fontSize: '12px', color: colors.neutral[600] }}>
              Includes calculated penal interest at 11.10% per annum (SBI MCLR + 2%)
            </div>
            <DataTable
              columns={overdueColumns}
              data={overduePayments}
              selectable
              sortable
            />
          </div>
        ) : (
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No overdue payments
          </div>
        )}
      </Card>

      {showReceiptForm && (
        <ReceiptRecordingForm
          onSubmit={handleRecordReceipt}
          onCancel={() => setShowReceiptForm(false)}
          isLoading={recordReceiptMutation.isPending}
        />
      )}
    </div>
  );
}

interface ReceiptRecordingFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ReceiptRecordingForm({ onSubmit, onCancel, isLoading }: ReceiptRecordingFormProps) {
  const [formData, setFormData] = useState({
    paymentPlanId: '',
    installmentIndex: 1,
    amountReceivedInr: 0,
    paymentMethod: 'bank_transfer',
    transactionRef: '',
    receivedDate: new Date().toISOString().split('T')[0],
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
        <h2 style={{ marginTop: 0 }}>Record Receipt</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label>Payment Plan ID*</label>
            <input
              type="text"
              value={formData.paymentPlanId}
              onChange={(e) => setFormData({ ...formData, paymentPlanId: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Installment Index*</label>
            <input
              type="number"
              value={formData.installmentIndex}
              onChange={(e) => setFormData({ ...formData, installmentIndex: parseInt(e.target.value) })}
              required
              min={1}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Amount Received (₹)*</label>
            <input
              type="number"
              value={formData.amountReceivedInr}
              onChange={(e) => setFormData({ ...formData, amountReceivedInr: parseFloat(e.target.value) })}
              required
              min={0}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Payment Method*</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="neft">NEFT</option>
              <option value="rtgs">RTGS</option>
              <option value="upi">UPI</option>
            </select>
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Transaction Reference</label>
            <input
              type="text"
              value={formData.transactionRef}
              onChange={(e) => setFormData({ ...formData, transactionRef: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Received Date*</label>
            <input
              type="date"
              value={formData.receivedDate}
              onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Recording...' : 'Record'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
