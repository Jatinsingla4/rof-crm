import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, spacing, colors } from '@rof-crm/design-system';
import { apiClient } from '../../api/client';

interface Folder {
  id: string;
  folder_name: string;
  folder_type: string;
  document_count: number;
  sort_order: number;
}

interface Document {
  id: string;
  file_name: string;
  document_category: string;
  file_url: string;
  created_at: string;
}

export function ConsumerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'payments'>('profile');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    received_date: new Date().toISOString().split('T')[0],
    transaction_ref: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'documents') {
      fetchFolders();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedFolder) {
      fetchDocuments();
    }
  }, [selectedFolder]);

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/consumers/${id}/folders`);
      const data = response.data;
      if (data.success) {
        setFolders(data.data);
        if (data.data.length > 0 && !selectedFolder) {
          setSelectedFolder(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/consumers/${id}/folders/${selectedFolder}/documents`);
      const data = response.data;
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPaymentModal = () => {
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentForm({
      amount: '',
      payment_method: 'bank_transfer',
      received_date: new Date().toISOString().split('T')[0],
      transaction_ref: '',
    });
  };

  const handleSubmitPayment = async () => {
    if (!paymentForm.amount) {
      alert('Please enter an amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`/consumers/${id}/payments`, {
        amount_inr: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        received_date: paymentForm.received_date,
        transaction_ref: paymentForm.transaction_ref || null,
      });

      if (response.data.success) {
        alert('Payment recorded successfully');
        handleClosePaymentModal();
      } else {
        alert('Failed to record payment: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to record payment:', error);
      alert('Failed to record payment: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '12px 20px',
    borderBottom: isActive ? '3px solid #1890ff' : '1px solid #d9d9d9',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 500,
    color: isActive ? '#1890ff' : colors.neutral[600],
    background: 'transparent',
    border: 'none',
  });

  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>
        Consumer Details
      </h1>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.neutral[300]}`, marginBottom: spacing.lg }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={tabStyle(activeTab === 'profile')}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          style={tabStyle(activeTab === 'documents')}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          style={tabStyle(activeTab === 'payments')}
        >
          Payments
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing.lg }}>
          <Card variant="elevated">
            <div style={{ padding: spacing.md }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: spacing.md }}>
                Profile Information
              </h3>
              <p>Consumer ID: {id}</p>
              <p style={{ marginTop: spacing.sm }}>Loading consumer details...</p>
            </div>
          </Card>

          <div>
            <Card variant="elevated" style={{ marginBottom: spacing.lg }}>
              <div style={{ padding: spacing.md }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                  Payment Summary
                </h4>
                <p style={{ fontSize: '12px', color: colors.neutral[600] }}>Total Due: ₹0</p>
                <p style={{ fontSize: '12px', color: colors.neutral[600] }}>Collected: ₹0</p>
                <p style={{ fontSize: '12px', color: colors.neutral[600] }}>Outstanding: ₹0</p>
              </div>
            </Card>

            <Card variant="elevated">
              <div style={{ padding: spacing.md }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                  Quick Actions
                </h4>
                <button
                  onClick={handleOpenPaymentModal}
                  style={{
                    width: '100%',
                    padding: spacing.sm,
                    background: '#722ED1',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    marginBottom: spacing.xs,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = '#5b1da1';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = '#722ED1';
                  }}
                >
                  Record Payment
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: spacing.lg }}>
          {/* Folder Sidebar */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.md }}>Folders</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {isLoading && folders.length === 0 ? (
                <div style={{ color: colors.neutral[500], fontSize: '12px' }}>Loading folders...</div>
              ) : folders.length === 0 ? (
                <div style={{ color: colors.neutral[500], fontSize: '12px' }}>No folders found</div>
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    style={{
                      padding: '12px',
                      backgroundColor: selectedFolder === folder.id ? colors.primary[500] : colors.neutral[100],
                      color: selectedFolder === folder.id ? 'white' : colors.neutral[800],
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: selectedFolder === folder.id ? 600 : 500,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFolder !== folder.id) {
                        (e.target as HTMLElement).style.backgroundColor = colors.neutral[200];
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFolder !== folder.id) {
                        (e.target as HTMLElement).style.backgroundColor = colors.neutral[100];
                      }
                    }}
                  >
                    <div>{folder.folder_name}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>
                      {folder.document_count} files
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Documents List */}
          <div>
            {selectedFolder ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                    {folders.find((f) => f.id === selectedFolder)?.folder_name}
                  </h3>
                  <button
                    style={{
                      padding: '8px 16px',
                      backgroundColor: colors.primary[500],
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    Upload File
                  </button>
                </div>

                {isLoading ? (
                  <Card variant="elevated">
                    <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[500] }}>
                      Loading documents...
                    </div>
                  </Card>
                ) : documents.length === 0 ? (
                  <Card variant="elevated">
                    <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[500] }}>
                      No documents in this folder
                    </div>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                    {documents.map((doc) => (
                      <Card key={doc.id} variant="elevated" padding="spacious">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                              {doc.file_name}
                            </h4>
                            <div style={{ fontSize: '12px', color: colors.neutral[600] }}>
                              {doc.document_category} • {new Date(doc.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: spacing.sm }}>
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '6px 12px',
                                backgroundColor: colors.primary[100],
                                color: colors.primary[600],
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                textDecoration: 'none',
                              }}
                            >
                              View
                            </a>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Card variant="elevated">
                <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[500] }}>
                  Select a folder to view documents
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <Card variant="elevated">
          <div style={{ padding: spacing.lg }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: spacing.md }}>Payments</h3>
            <p style={{ color: colors.neutral[500] }}>Payment history will be displayed here</p>
          </div>
        </Card>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleClosePaymentModal}
        >
          <Card
            style={{
              width: '90%',
              maxWidth: '500px',
              padding: spacing.lg,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: spacing.lg }}>Record Payment</h3>

            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                Amount (₹)
              </label>
              <input
                type="number"
                placeholder="Enter amount"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[300]}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                Payment Method
              </label>
              <select
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[300]}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="upi">UPI</option>
              </select>
            </div>

            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                Date Received
              </label>
              <input
                type="date"
                value={paymentForm.received_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, received_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[300]}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: spacing.sm }}>
                Transaction Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., UTR, Cheque No, UPI Ref ID"
                value={paymentForm.transaction_ref}
                onChange={(e) => setPaymentForm({ ...paymentForm, transaction_ref: e.target.value })}
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[300]}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
              <button
                onClick={handleClosePaymentModal}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${colors.neutral[300]}`,
                  backgroundColor: colors.neutral[100],
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#722ED1',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
