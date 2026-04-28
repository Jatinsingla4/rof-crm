import { useState, useRef } from 'react';
import { Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';
import {
  useUploadReconciliation,
  useReconciliationImports,
  useReconciliationTransactions,
  useMatchTransaction,
  useIgnoreTransaction,
  ReconciliationImport,
  ReconciliationTransaction,
} from '../../hooks/usePaymentFinance';

export function BankReconciliationPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'review'>('import');
  const [selectedImportId, setSelectedImportId] = useState<string>('');
  const [transactionFilter, setTransactionFilter] = useState<string>('all');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadReconciliation = useUploadReconciliation();
  const { data: imports = [], isLoading: importsLoading } = useReconciliationImports();
  const { data: transactions = [], isLoading: transactionsLoading } =
    useReconciliationTransactions(selectedImportId);
  const matchTransaction = useMatchTransaction();
  const ignoreTransaction = useIgnoreTransaction();

  // Set first import as default when imports load
  if (imports.length > 0 && !selectedImportId) {
    setSelectedImportId(imports[0].id);
  }

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    uploadReconciliation.mutate(file, {
      onSuccess: (data) => {
        setUploadSuccess(true);
        setUploadSummary(data);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Reset after 3 seconds
        setTimeout(() => {
          setUploadSuccess(false);
          setUploadSummary(null);
        }, 3000);
      },
    });
  };

  const handleDragDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleIgnore = async (transactionId: string) => {
    try {
      await ignoreTransaction.mutateAsync(transactionId);
    } catch (error) {
      console.error('Error ignoring transaction:', error);
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((t: ReconciliationTransaction) => {
    if (transactionFilter === 'all') return true;
    return t.status === transactionFilter;
  });

  const statusColors: { [key: string]: { bg: string; text: string } } = {
    auto_matched: { bg: '#E6FFED', text: '#274916' },
    manually_matched: { bg: '#E6F7FF', text: '#003A8C' },
    unmatched: { bg: '#FFF1F0', text: '#820014' },
    ignored: { bg: '#F5F5F5', text: '#595959' },
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0, marginBottom: spacing.lg }}>Bank Reconciliation</h1>

      {/* Tabs */}
      <div style={{ marginBottom: spacing.lg, display: 'flex', gap: spacing.sm }}>
        <button
          onClick={() => setActiveTab('import')}
          style={{
            padding: `${spacing.sm} ${spacing.md}`,
            background: activeTab === 'import' ? '#1890FF' : colors.neutral[200],
            color: activeTab === 'import' ? '#FFFFFF' : colors.neutral[800],
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'background 150ms',
          }}
        >
          Import Statement
        </button>
        <button
          onClick={() => setActiveTab('review')}
          style={{
            padding: `${spacing.sm} ${spacing.md}`,
            background: activeTab === 'review' ? '#1890FF' : colors.neutral[200],
            color: activeTab === 'review' ? '#FFFFFF' : colors.neutral[800],
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'background 150ms',
          }}
        >
          Review Transactions
        </button>
      </div>

      {/* TAB 1: Import Statement */}
      {activeTab === 'import' && (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.lg }}>
              Upload Bank Statement
            </h2>

            {/* Drag and Drop Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => e.preventDefault()}
              onDrop={handleDragDrop}
              style={{
                border: `2px dashed ${colors.neutral[300]}`,
                borderRadius: '8px',
                padding: spacing.lg,
                textAlign: 'center',
                background: '#FAFAFA',
                marginBottom: spacing.lg,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1890FF';
                e.currentTarget.style.background = '#F0F5FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.neutral[300];
                e.currentTarget.style.background = '#FAFAFA';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: spacing.md }}>📄</div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: spacing.sm }}>
                Drag and drop CSV file here
              </div>
              <div style={{ fontSize: '13px', color: colors.neutral[600], marginBottom: spacing.md }}>
                or click to browse
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(file);
                  }
                }}
                style={{
                  position: 'absolute',
                  width: 0,
                  height: 0,
                  opacity: 0,
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: '#1890FF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              >
                Browse Files
              </button>
            </div>

            <div style={{ fontSize: '12px', color: colors.neutral[600], lineHeight: '1.6' }}>
              <strong>CSV Format Expected:</strong>
              <br />
              Date, Description, Amount, Reference, Account
              <br />
              <br />
              Example:
              <br />
              2026-04-28, Payment from HDFC, 50000, TRF123456, Savings
            </div>

            {/* Upload Success Message */}
            {uploadSuccess && uploadSummary && (
              <div
                style={{
                  marginTop: spacing.lg,
                  padding: spacing.md,
                  background: '#E6FFED',
                  border: '1px solid #B7EB8F',
                  borderRadius: '4px',
                  color: '#274916',
                  fontSize: '13px',
                }}
              >
                ✓ Import complete: {uploadSummary.matched_count} matched,{' '}
                {uploadSummary.unmatched_count} unmatched
              </div>
            )}

            {/* Upload Error Message */}
            {uploadReconciliation.isError && (
              <div
                style={{
                  marginTop: spacing.lg,
                  padding: spacing.md,
                  background: '#FFF1F0',
                  border: '1px solid #FFCCC7',
                  borderRadius: '4px',
                  color: '#820014',
                  fontSize: '13px',
                }}
              >
                ✗ Error uploading file. Please try again.
              </div>
            )}

            {uploadReconciliation.isPending && (
              <div
                style={{
                  marginTop: spacing.lg,
                  textAlign: 'center',
                  color: colors.neutral[600],
                  fontSize: '13px',
                }}
              >
                Uploading and processing...
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 2: Review Transactions */}
      {activeTab === 'review' && (
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: spacing.lg }}>
          {/* Import History Sidebar */}
          <Card>
            <div style={{ padding: spacing.lg }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
                Import History
              </h3>

              {importsLoading ? (
                <LoadingSkeleton height={150} />
              ) : imports.length === 0 ? (
                <div style={{ fontSize: '13px', color: colors.neutral[600] }}>
                  No imports yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {imports.map((imp: ReconciliationImport) => (
                    <button
                      key={imp.id}
                      onClick={() => setSelectedImportId(imp.id)}
                      style={{
                        padding: spacing.md,
                        background: selectedImportId === imp.id ? '#1890FF' : colors.neutral[100],
                        color: selectedImportId === imp.id ? '#FFFFFF' : colors.neutral[800],
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '12px',
                        transition: 'background 150ms',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        {new Date(imp.import_date).toLocaleDateString('en-IN')}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        {imp.total_transactions} transactions
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        {imp.matched_count} matched
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Transactions List */}
          <Card>
            <div style={{ padding: spacing.lg }}>
              <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing.sm }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, flex: 1 }}>
                  Transactions
                </h3>

                {/* Filter buttons */}
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  {['all', 'auto_matched', 'manually_matched', 'unmatched', 'ignored'].map(
                    (filter) => (
                      <button
                        key={filter}
                        onClick={() => setTransactionFilter(filter)}
                        style={{
                          padding: '4px 8px',
                          background: transactionFilter === filter ? '#1890FF' : colors.neutral[200],
                          color: transactionFilter === filter ? '#FFFFFF' : colors.neutral[800],
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          textTransform: 'capitalize',
                        }}
                      >
                        {filter.replace(/_/g, ' ')}
                      </button>
                    )
                  )}
                </div>
              </div>

              {transactionsLoading ? (
                <LoadingSkeleton height={200} />
              ) : selectedImportId && filteredTransactions.length === 0 ? (
                <div style={{ padding: spacing.md, textAlign: 'center', color: colors.neutral[600] }}>
                  No transactions match this filter
                </div>
              ) : !selectedImportId ? (
                <div style={{ padding: spacing.md, textAlign: 'center', color: colors.neutral[600] }}>
                  Select an import to view transactions
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                        <th style={{ textAlign: 'left', padding: spacing.sm }}>Date</th>
                        <th style={{ textAlign: 'left', padding: spacing.sm }}>Description</th>
                        <th style={{ textAlign: 'right', padding: spacing.sm }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: spacing.sm }}>Reference</th>
                        <th style={{ textAlign: 'center', padding: spacing.sm }}>Status</th>
                        <th style={{ textAlign: 'center', padding: spacing.sm }}>Confidence</th>
                        <th style={{ textAlign: 'center', padding: spacing.sm }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((transaction: ReconciliationTransaction) => {
                        const statusColor =
                          statusColors[transaction.status] || statusColors['unmatched'];

                        return (
                          <tr
                            key={transaction.id}
                            style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}
                          >
                            <td style={{ padding: spacing.sm }}>
                              {new Date(transaction.transaction_date).toLocaleDateString('en-IN', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit',
                              })}
                            </td>
                            <td
                              style={{
                                padding: spacing.sm,
                                maxWidth: '150px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={transaction.description}
                            >
                              {transaction.description}
                            </td>
                            <td style={{ textAlign: 'right', padding: spacing.sm, fontWeight: 600 }}>
                              Rs. {transaction.amount_inr?.toLocaleString('en-IN') || 0}
                            </td>
                            <td
                              style={{
                                padding: spacing.sm,
                                fontSize: '11px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {transaction.reference || '—'}
                            </td>
                            <td style={{ textAlign: 'center', padding: spacing.sm }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 6px',
                                  background: statusColor.bg,
                                  color: statusColor.text,
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {transaction.status?.replace(/_/g, ' ') || '—'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: spacing.sm }}>
                              {transaction.match_confidence ? (
                                <span style={{ fontSize: '11px', fontWeight: 600 }}>
                                  {transaction.match_confidence}%
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td style={{ textAlign: 'center', padding: spacing.sm }}>
                              {transaction.status === 'unmatched' ? (
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  <button
                                    onClick={() => matchTransaction.mutate(transaction.id)}
                                    disabled={matchTransaction.isPending}
                                    style={{
                                      padding: '3px 6px',
                                      background: '#1890FF',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      borderRadius: '2px',
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontWeight: 500,
                                    }}
                                  >
                                    Match
                                  </button>
                                  <button
                                    onClick={() => handleIgnore(transaction.id)}
                                    disabled={ignoreTransaction.isPending}
                                    style={{
                                      padding: '3px 6px',
                                      background: colors.neutral[300],
                                      color: colors.neutral[800],
                                      border: 'none',
                                      borderRadius: '2px',
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontWeight: 500,
                                    }}
                                  >
                                    Ignore
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: colors.neutral[600], fontSize: '10px' }}>
                                  ✓
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
