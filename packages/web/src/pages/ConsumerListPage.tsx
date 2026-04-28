import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsumers, useCreateConsumer } from '../hooks';
import { DataTable, SearchFilter, Button, Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

export function ConsumerListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [leadStage, setLeadStage] = useState('');
  const [projectId, setProjectId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: consumers, isLoading, error } = useConsumers({
    search,
    leadStage: leadStage || undefined,
    projectId: projectId || undefined,
    page,
    pageSize: 20,
  });

  const createConsumerMutation = useCreateConsumer();

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (item: any) => (
        <Link
          to={`/consumers/${item.id}`}
          style={{ color: colors.primary[600], textDecoration: 'none', fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          {item.name}
        </Link>
      ),
    },
    { key: 'mobile', header: 'Mobile', render: (item: any) => item.mobile },
    { key: 'email', header: 'Email', render: (item: any) => item.email },
    { key: 'lead_stage', header: 'Lead Stage', render: (item: any) => item.lead_stage },
    { key: 'project_id', header: 'Project', render: (item: any) => item.project_id },
    { key: 'created_at', header: 'Created', render: (item: any) => new Date(item.created_at).toLocaleDateString() },
  ];

  const handleCreateConsumer = async (formData: any) => {
    try {
      await createConsumerMutation.mutateAsync(formData);
      setShowCreateForm(false);
    } catch (err) {
      console.error('Failed to create consumer:', err);
    }
  };

  if (error) {
    return (
      <Card>
        <div style={{ padding: spacing.lg, color: colors.error[600] }}>
          Failed to load consumers. Please try again.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ marginBottom: spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <h1 style={{ margin: 0 }}>Consumers</h1>
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
          >
            Add Consumer
          </Button>
        </div>

        <SearchFilter
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          filterOptions={[
            {
              label: 'Lead Stage',
              value: leadStage,
              onChange: (value) => {
                setLeadStage(value);
                setPage(1);
              },
              options: [
                { label: 'All', value: '' },
                { label: 'Enquiry', value: 'enquiry' },
                { label: 'Interested', value: 'interested' },
                { label: 'Application Filed', value: 'application_filed' },
                { label: 'Draw Entered', value: 'draw_entered' },
                { label: 'Allotted', value: 'allotted' },
                { label: 'Cancelled', value: 'cancelled' },
              ],
            },
          ]}
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton height={400} />
      ) : consumers && Array.isArray(consumers) && consumers.length > 0 ? (
        <DataTable
          columns={columns}
          data={consumers}
          keyField="id"
          selectable
          sortable
          pagination={{
            page,
            pageSize: 20,
            total: consumers.length,
            onPageChange: setPage,
          }}
        />
      ) : (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No consumers found
          </div>
        </Card>
      )}

      {showCreateForm && (
        <ConsumerCreateForm
          onSubmit={handleCreateConsumer}
          onCancel={() => setShowCreateForm(false)}
          isLoading={createConsumerMutation.isPending}
        />
      )}
    </div>
  );
}

interface ConsumerCreateFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ConsumerCreateForm({ onSubmit, onCancel, isLoading }: ConsumerCreateFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    aadhaar: '',
    pan: '',
    incomeCategory: 'lig',
    projectId: '',
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
        <h2 style={{ marginTop: 0 }}>Create Consumer</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label>Name*</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Mobile*</label>
            <input
              type="tel"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Income Category*</label>
            <select
              value={formData.incomeCategory}
              onChange={(e) => setFormData({ ...formData, incomeCategory: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            >
              <option value="ews">EWS</option>
              <option value="lig">LIG</option>
              <option value="mig">MIG</option>
            </select>
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Project ID*</label>
            <input
              type="text"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: 4, border: `1px solid ${colors.neutral[300]}` }}
            />
          </div>

          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
