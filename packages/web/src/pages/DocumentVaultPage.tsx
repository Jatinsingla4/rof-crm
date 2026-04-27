import React, { useState } from 'react';
import { useDocumentVault, useUploadDocumentVault, useSearchDocuments } from '../hooks';
import { Button, Card, DataTable, SearchFilter, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

const DOCUMENT_CATEGORIES = [
  'kyc',
  'application',
  'allotment',
  'payment_receipts',
  'agreements',
  'noc',
  'possession_letter',
  'other',
];

export function DocumentVaultPage({ consumerId }: { consumerId: string }) {
  const [activeTab, setActiveTab] = useState<'vault' | 'search'>('vault');
  const [documentCategory, setDocumentCategory] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Vault documents
  const { data: vaultDocuments, isLoading: vaultLoading } = useDocumentVault(
    consumerId,
    documentCategory || undefined
  );

  // Search documents
  const { data: searchResults, isLoading: searchLoading } = useSearchDocuments(searchQuery);

  const uploadMutation = useUploadDocumentVault();

  // Document columns
  const columns = [
    { id: 'category', header: 'Category', accessorKey: 'document_category' },
    { id: 'fileName', header: 'File Name', accessorKey: 'file_name' },
    {
      id: 'createdAt',
      header: 'Uploaded',
      accessorKey: 'created_at',
      cell: (value: string) => new Date(value).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions',
      header: 'Actions',
      accessorKey: 'file_url',
      cell: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary[600] }}>
          Download
        </a>
      ),
    },
  ];

  // Group documents by category
  const documentsByCategory = React.useMemo(() => {
    if (!vaultDocuments) return {};

    return vaultDocuments.reduce((acc: Record<string, any[]>, doc: any) => {
      if (!acc[doc.document_category]) {
        acc[doc.document_category] = [];
      }
      acc[doc.document_category].push(doc);
      return acc;
    }, {});
  }, [vaultDocuments]);

  const handleUploadDocument = async (formData: any) => {
    try {
      await uploadMutation.mutateAsync({
        consumerId,
        documentCategory: formData.category,
        fileUrl: formData.fileUrl,
        fileName: formData.fileName,
      });
      setShowUploadForm(false);
    } catch (err) {
      console.error('Failed to upload document:', err);
    }
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <h1 style={{ margin: 0 }}>Document Vault</h1>
        <Button variant="primary" onClick={() => setShowUploadForm(true)}>
          Upload Document
        </Button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          marginBottom: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[200]}`,
        }}
      >
        <button
          onClick={() => setActiveTab('vault')}
          style={{
            padding: `${spacing.md} ${spacing.lg}`,
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'vault' ? `2px solid ${colors.primary[600]}` : 'none',
            color: activeTab === 'vault' ? colors.primary[600] : colors.neutral[600],
            fontWeight: activeTab === 'vault' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Document Vault
        </button>
        <button
          onClick={() => setActiveTab('search')}
          style={{
            padding: `${spacing.md} ${spacing.lg}`,
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'search' ? `2px solid ${colors.primary[600]}` : 'none',
            color: activeTab === 'search' ? colors.primary[600] : colors.neutral[600],
            fontWeight: activeTab === 'search' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Search All
        </button>
      </div>

      {/* Vault Tab */}
      {activeTab === 'vault' && (
        <>
          {/* Category Filter */}
          <Card style={{ marginBottom: spacing.lg }}>
            <SearchFilter
              onSearch={() => {}}
              filterOptions={[
                {
                  label: 'Document Type',
                  value: documentCategory,
                  onChange: setDocumentCategory,
                  options: [
                    { label: 'All', value: '' },
                    ...DOCUMENT_CATEGORIES.map((cat) => ({
                      label: cat.replace(/_/g, ' ').toUpperCase(),
                      value: cat,
                    })),
                  ],
                },
              ]}
            />
          </Card>

          {/* Documents by Category */}
          {vaultLoading ? (
            <LoadingSkeleton height={400} />
          ) : Object.keys(documentsByCategory).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: spacing.lg }}>
              {Object.entries(documentsByCategory).map(([category, docs]: [string, any[]]) => (
                <Card key={category}>
                  <h3 style={{ marginTop: 0, color: colors.primary[600] }}>
                    {category.replace(/_/g, ' ').toUpperCase()}
                  </h3>
                  <div
                    style={{
                      overflowX: 'auto',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                          <th style={{ textAlign: 'left', padding: spacing.md }}>File Name</th>
                          <th style={{ textAlign: 'left', padding: spacing.md }}>Uploaded</th>
                          <th style={{ textAlign: 'left', padding: spacing.md }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map((doc: any) => (
                          <tr
                            key={doc.id}
                            style={{
                              borderBottom: `1px solid ${colors.neutral[100]}`,
                            }}
                          >
                            <td style={{ padding: spacing.md }}>{doc.file_name || 'Document'}</td>
                            <td style={{ padding: spacing.md }}>
                              {new Date(doc.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td style={{ padding: spacing.md }}>
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: colors.primary[600],
                                  textDecoration: 'none',
                                  fontWeight: 500,
                                }}
                              >
                                Download
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
                No documents in vault
              </div>
            </Card>
          )}
        </>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <>
          <Card style={{ marginBottom: spacing.lg }}>
            <input
              type="text"
              placeholder="Search documents by content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: `${spacing.md} ${spacing.md}`,
                borderRadius: 6,
                border: `1px solid ${colors.neutral[300]}`,
                fontSize: '14px',
              }}
            />
          </Card>

          {searchLoading ? (
            <LoadingSkeleton height={300} />
          ) : searchQuery && searchResults && searchResults.length > 0 ? (
            <Card>
              <h3>Search Results ({searchResults.length})</h3>
              <div style={{ display: 'grid', gap: spacing.md }}>
                {searchResults.map((result: any) => (
                  <div
                    key={result.id}
                    style={{
                      padding: spacing.md,
                      borderRadius: 6,
                      backgroundColor: colors.neutral[50],
                      borderLeft: `4px solid ${colors.primary[600]}`,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{result.document_type}</div>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.xs }}>
                      {result.html_content.substring(0, 100)}...
                    </div>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.xs }}>
                      {new Date(result.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : searchQuery ? (
            <Card>
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
                No documents found for "{searchQuery}"
              </div>
            </Card>
          ) : (
            <Card>
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
                Enter search term to find documents
              </div>
            </Card>
          )}
        </>
      )}

      {/* Upload Form Modal */}
      {showUploadForm && (
        <DocumentUploadForm
          onSubmit={handleUploadDocument}
          onCancel={() => setShowUploadForm(false)}
          isLoading={uploadMutation.isPending}
        />
      )}
    </div>
  );
}

interface DocumentUploadFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DocumentUploadForm({ onSubmit, onCancel, isLoading }: DocumentUploadFormProps) {
  const [formData, setFormData] = useState({
    category: 'kyc',
    fileName: '',
    fileUrl: '',
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
        <h2 style={{ marginTop: 0 }}>Upload Document</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label>Document Category*</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>File Name</label>
            <input
              type="text"
              value={formData.fileName}
              onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
              placeholder="e.g., Aadhaar_Card_Scan"
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>File URL*</label>
            <input
              type="url"
              value={formData.fileUrl}
              onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
              placeholder="https://..."
              required
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
