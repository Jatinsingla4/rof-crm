import { useState } from 'react';
import { Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';
import {
  useDrawRefunds,
  useOverdueRefunds,
  useInitiateRefund,
  useCompleteRefund,
  DrawRefund,
} from '../../hooks/usePaymentFinance';

interface ModalProps {
  isOpen: boolean;
  refund: DrawRefund | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  type: 'initiate' | 'complete';
}

function ActionModal({ isOpen, refund, onClose, onSubmit, isLoading, type }: ModalProps) {
  const [referenceNumber, setReferenceNumber] = useState('');
  const [finalReference, setFinalReference] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen || !refund) return null;

  const handleSubmit = () => {
    if (type === 'initiate') {
      onSubmit({
        refundId: refund.id,
        referenceNumber,
        notes,
      });
    } else {
      onSubmit({
        refundId: refund.id,
        finalReference,
      });
    }
    // Reset form
    setReferenceNumber('');
    setFinalReference('');
    setNotes('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <Card
        style={{
          width: '90%',
          maxWidth: '450px',
          background: '#FFFFFF',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: spacing.lg }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
            {type === 'initiate' ? 'Initiate Refund' : 'Mark Refund Complete'}
          </h2>

          <div style={{ marginBottom: spacing.md, fontSize: '13px', color: colors.neutral[600] }}>
            Consumer: <strong>{refund.consumer_name}</strong>
            <br />
            Amount: <strong>Rs. {refund.refund_amount.toLocaleString('en-IN')}</strong>
          </div>

          {type === 'initiate' ? (
            <>
              <div style={{ marginBottom: spacing.md }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
                  Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g., TRF-2026-001"
                  style={{
                    width: '100%',
                    padding: spacing.sm,
                    border: `1px solid ${colors.neutral[300]}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: spacing.lg }}>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any notes about this refund..."
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: spacing.sm,
                    border: `1px solid ${colors.neutral[300]}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
                Final Reference Number
              </label>
              <input
                type="text"
                value={finalReference}
                onChange={(e) => setFinalReference(e.target.value)}
                placeholder="e.g., UTR or Receipt Number"
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[300]}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: spacing.md,
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: colors.neutral[200],
                color: colors.neutral[800],
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                isLoading ||
                (type === 'initiate' ? !referenceNumber.trim() : !finalReference.trim())
              }
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: '#52C41A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                opacity:
                  isLoading ||
                  (type === 'initiate' ? !referenceNumber.trim() : !finalReference.trim())
                    ? 0.6
                    : 1,
              }}
            >
              {isLoading ? 'Saving...' : type === 'initiate' ? 'Initiate Refund' : 'Mark Complete'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DrawRefundsPage() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedRefund, setSelectedRefund] = useState<DrawRefund | null>(null);
  const [modalType, setModalType] = useState<'initiate' | 'complete'>('initiate');
  const [showModal, setShowModal] = useState(false);

  const { data: refunds = [], isLoading, error } = useDrawRefunds({
    status: activeFilter === 'all' ? undefined : activeFilter,
  });
  const { data: overdueData } = useOverdueRefunds();
  const initiateRefund = useInitiateRefund();
  const completeRefund = useCompleteRefund();

  const filters = ['all', 'pending', 'initiated', 'completed', 'overdue'];

  const isOverdue = (refund: DrawRefund) => {
    const dueDate = new Date(refund.due_by);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today && refund.status !== 'completed';
  };

  const handleOpenModal = (refund: DrawRefund, type: 'initiate' | 'complete') => {
    setSelectedRefund(refund);
    setModalType(type);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRefund(null);
  };

  const handleSubmit = async (data: any) => {
    try {
      if (modalType === 'initiate') {
        await initiateRefund.mutateAsync(data);
      } else {
        await completeRefund.mutateAsync(data);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error updating refund:', error);
    }
  };

  // Summary calculations
  const pendingCount = refunds.filter((r: DrawRefund) => r.status === 'pending').length;
  const overdueCount = overdueData?.count || 0;
  const totalAmount = refunds.reduce((sum: number, r: DrawRefund) => sum + r.refund_amount, 0);

  const statusColors: { [key: string]: { bg: string; text: string } } = {
    pending: { bg: '#FFFBE6', text: '#6F4E37' },
    initiated: { bg: '#E6F7FF', text: '#003A8C' },
    completed: { bg: '#E6FFED', text: '#274916' },
    overdue: { bg: '#FFEBE9', text: '#820014' },
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0, marginBottom: spacing.lg }}>Draw Refunds Management</h1>

      {/* Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1890FF' }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Total Pending Refunds
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center' }}>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: overdueCount > 0 ? '#F5222D' : '#52C41A',
              }}
            >
              {overdueCount}
            </div>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Overdue Refunds
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#1890FF' }}>
              Rs. {totalAmount.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Total Amount Pending
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div style={{ marginBottom: spacing.lg, display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              background: activeFilter === filter ? '#1890FF' : colors.neutral[200],
              color: activeFilter === filter ? '#FFFFFF' : colors.neutral[800],
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
              textTransform: 'capitalize',
              transition: 'background 150ms',
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Refunds Table */}
      {isLoading ? (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <LoadingSkeleton height={200} />
          </div>
        </Card>
      ) : error || !refunds ? (
        <Card style={{ background: '#FFF1F0', border: '1px solid #FFCCC7' }}>
          <div style={{ padding: spacing.lg, color: '#820014' }}>
            Error loading refunds: {error?.message || 'Unknown error'}
          </div>
        </Card>
      ) : refunds.length === 0 ? (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No refunds found for this filter
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Consumer Name</th>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Project</th>
                    <th style={{ textAlign: 'right', padding: spacing.md }}>Booking Amount</th>
                    <th style={{ textAlign: 'right', padding: spacing.md }}>Refund Amount</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Due By</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Status</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((refund: DrawRefund) => {
                    const overdue = isOverdue(refund);
                    const statusColor =
                      statusColors[overdue ? 'overdue' : refund.status] ||
                      statusColors['pending'];

                    return (
                      <tr
                        key={refund.id}
                        style={{
                          borderBottom: `1px solid ${colors.neutral[100]}`,
                          background: overdue ? '#FFEBE9' : 'transparent',
                        }}
                      >
                        <td style={{ padding: spacing.md, fontWeight: 500 }}>
                          {refund.consumer_name}
                        </td>
                        <td style={{ padding: spacing.md }}>{refund.project_name}</td>
                        <td style={{ textAlign: 'right', padding: spacing.md }}>
                          Rs. {refund.booking_amount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', padding: spacing.md, fontWeight: 600 }}>
                          Rs. {refund.refund_amount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {new Date(refund.due_by).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              background: statusColor.bg,
                              color: statusColor.text,
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                            }}
                          >
                            {overdue ? 'Overdue' : refund.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {refund.status === 'pending' ? (
                            <button
                              onClick={() => handleOpenModal(refund, 'initiate')}
                              style={{
                                padding: '4px 10px',
                                background: '#1890FF',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              Initiate
                            </button>
                          ) : refund.status === 'initiated' ? (
                            <button
                              onClick={() => handleOpenModal(refund, 'complete')}
                              style={{
                                padding: '4px 10px',
                                background: '#52C41A',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              Complete
                            </button>
                          ) : (
                            <span style={{ color: colors.neutral[600], fontSize: '12px' }}>✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Modal */}
      <ActionModal
        isOpen={showModal}
        refund={selectedRefund}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isLoading={initiateRefund.isPending || completeRefund.isPending}
        type={modalType}
      />
    </div>
  );
}
