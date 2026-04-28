import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';
import { apiClient } from '../../api/client';
import { useAllotmentDashboard } from '../../hooks/useReport';

interface Allocation {
  id: string;
  consumer_id: string;
  consumer_name: string;
  unit_id: string;
  unit_number: string;
  project_id: string;
  project_name: string;
  status: string;
  allocated_date: string;
  created_at: string;
}

export function AllocationsPage() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: allotmentData } = useAllotmentDashboard();
  const projects = allotmentData?.byProject || [];

  // Fetch allocations on mount
  useEffect(() => {
    fetchAllocations();
  }, [projectFilter, statusFilter]);

  const fetchAllocations = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (projectFilter) params.projectId = projectFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await apiClient.get('/allocations', { params });
      if (response.data.success) {
        setAllocations(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch allocations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors: { [key: string]: { bg: string; text: string } } = {
    active: { bg: '#E6FFED', text: '#274916' },
    cancelled: { bg: '#FFF1F0', text: '#820014' },
    pending: { bg: '#FFFBE6', text: '#6F4E37' },
    completed: { bg: '#E6F7FF', text: '#003A8C' },
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <h1 style={{ marginTop: 0 }}>Allocations</h1>
        <div style={{ display: 'flex', gap: spacing.md }}>
          <button
            onClick={() => navigate('/allocations/waitlist')}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              background: '#722ED1',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            View Waitlist
          </button>
          <button
            onClick={() => navigate('/allocations/import')}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              background: '#FA8C16',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Import E-Draw
          </button>
          <button
            onClick={() => navigate('/allotments/new')}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              background: '#1890FF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            + New Allocation
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm, fontSize: '13px' }}>
            Project
          </label>
          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
            }}
            style={{
              width: '100%',
              padding: spacing.sm,
              border: `1px solid ${colors.neutral[300]}`,
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            <option value="">All Projects</option>
            {projects.map((p: any) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm, fontSize: '13px' }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
            style={{
              width: '100%',
              padding: spacing.sm,
              border: `1px solid ${colors.neutral[300]}`,
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Allocations Table */}
      {isLoading ? (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <LoadingSkeleton height={200} />
          </div>
        </Card>
      ) : allocations.length === 0 ? (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No allocations found
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
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Unit</th>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Project</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Status</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Allocated Date</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((allocation) => {
                    const statusColor = statusColors[allocation.status] || statusColors['active'];

                    return (
                      <tr key={allocation.id} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                        <td style={{ padding: spacing.md, fontWeight: 500 }}>
                          <Link
                            to={`/consumers/${allocation.consumer_id}`}
                            style={{
                              color: colors.primary[600],
                              textDecoration: 'none',
                            }}
                          >
                            {allocation.consumer_name}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {allocation.unit_number}
                        </td>
                        <td style={{ padding: spacing.md }}>
                          {allocation.project_name}
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
                              textTransform: 'capitalize',
                            }}
                          >
                            {allocation.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {new Date(allocation.allocated_date).toLocaleDateString('en-IN', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          <Link
                            to={`/consumers/${allocation.consumer_id}`}
                            style={{
                              padding: '4px 12px',
                              background: '#1890FF',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 500,
                              textDecoration: 'none',
                              display: 'inline-block',
                            }}
                          >
                            View Details
                          </Link>
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
    </div>
  );
}
