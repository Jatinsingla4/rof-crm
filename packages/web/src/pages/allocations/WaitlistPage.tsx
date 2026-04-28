import { useState } from 'react';
import { Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';
import {
  useWaitlist,
  usePromoteWaitlistEntry,
  useCreateWaitlistEntry,
  WaitlistEntry,
} from '../../hooks/useWaitlist';
import { useAllotmentDashboard } from '../../hooks/useReport';

interface PromoteModalProps {
  isOpen: boolean;
  entry: WaitlistEntry | null;
  onClose: () => void;
  onSubmit: (unitId: string) => void;
  isLoading: boolean;
}

function PromoteModal({ isOpen, entry, onClose, onSubmit, isLoading }: PromoteModalProps) {
  const [selectedUnitId, setSelectedUnitId] = useState('');

  if (!isOpen || !entry) return null;

  const handleSubmit = () => {
    if (selectedUnitId) {
      onSubmit(selectedUnitId);
      setSelectedUnitId('');
    }
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
            Promote from Waitlist
          </h2>

          <div style={{ marginBottom: spacing.lg, fontSize: '13px', color: colors.neutral[600] }}>
            Consumer: <strong>{entry.consumer_name}</strong>
            <br />
            Unit Type: <strong>{entry.unit_type}</strong>
            <br />
            Position: <strong>#{entry.position}</strong>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Select Unit to Allot
            </label>
            <input
              type="text"
              placeholder="Enter unit ID (e.g., A-101)"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              style={{
                width: '100%',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Enter the specific unit number to assign to this consumer
            </div>
          </div>

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
              disabled={isLoading || !selectedUnitId.trim()}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: '#52C41A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                opacity: isLoading || !selectedUnitId.trim() ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Promoting...' : 'Promote & Allot'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  projects: any[];
}

function AddWaitlistModal({ isOpen, onClose, onSubmit, isLoading, projects }: AddModalProps) {
  const [consumerId, setConsumerId] = useState('');
  const [projectId, setProjectId] = useState(projects.length > 0 ? projects[0].projectId : '');
  const [unitType, setUnitType] = useState('2BHK');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (consumerId && projectId && unitType) {
      onSubmit({ consumerId, projectId, unitType });
      setConsumerId('');
      setUnitType('2BHK');
    }
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
            Add to Waitlist
          </h2>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Consumer ID
            </label>
            <input
              type="text"
              placeholder="Enter consumer ID"
              value={consumerId}
              onChange={(e) => setConsumerId(e.target.value)}
              style={{
                width: '100%',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{
                width: '100%',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Unit Type
            </label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              style={{
                width: '100%',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="2BHK">2BHK</option>
              <option value="3BHK">3BHK</option>
              <option value="1BHK">1BHK</option>
              <option value="studio">Studio</option>
            </select>
          </div>

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
              disabled={isLoading || !consumerId.trim()}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: '#1890FF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                opacity: isLoading || !consumerId.trim() ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Adding...' : 'Add to Waitlist'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function WaitlistPage() {
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [unitTypeFilter, setUnitTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: allotmentData } = useAllotmentDashboard();
  const projects = allotmentData?.byProject || [];

  const filters: any = {};
  if (projectFilter) filters.projectId = projectFilter;
  if (unitTypeFilter) filters.unitType = unitTypeFilter;
  if (statusFilter) filters.status = statusFilter;

  const { data: waitlist = [], isLoading, error } = useWaitlist(Object.keys(filters).length > 0 ? filters : undefined);
  const promoteEntry = usePromoteWaitlistEntry();
  const addEntry = useCreateWaitlistEntry();

  const handleOpenPromoteModal = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setShowPromoteModal(true);
  };

  const handleClosePromoteModal = () => {
    setShowPromoteModal(false);
    setSelectedEntry(null);
  };

  const handlePromoteSubmit = async (unitId: string) => {
    if (selectedEntry) {
      try {
        await promoteEntry.mutateAsync({ entryId: selectedEntry.id, unitId });
        handleClosePromoteModal();
      } catch (error) {
        console.error('Error promoting entry:', error);
      }
    }
  };

  const handleAddSubmit = async (data: any) => {
    try {
      await addEntry.mutateAsync(data);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding to waitlist:', error);
    }
  };

  const statusColors: { [key: string]: { bg: string; text: string } } = {
    waiting: { bg: '#E6F7FF', text: '#003A8C' },
    promoted: { bg: '#E6FFED', text: '#274916' },
    cancelled: { bg: '#F5F5F5', text: '#595959' },
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <h1 style={{ marginTop: 0 }}>Waitlist Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
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
          + Add to Waitlist
        </button>
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
            onChange={(e) => setProjectFilter(e.target.value)}
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
            Unit Type
          </label>
          <select
            value={unitTypeFilter}
            onChange={(e) => setUnitTypeFilter(e.target.value)}
            style={{
              width: '100%',
              padding: spacing.sm,
              border: `1px solid ${colors.neutral[300]}`,
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            <option value="">All Types</option>
            <option value="2BHK">2BHK</option>
            <option value="3BHK">3BHK</option>
            <option value="1BHK">1BHK</option>
            <option value="studio">Studio</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm, fontSize: '13px' }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: spacing.sm,
              border: `1px solid ${colors.neutral[300]}`,
              borderRadius: '4px',
              fontSize: '13px',
            }}
          >
            <option value="">All Statuses</option>
            <option value="waiting">Waiting</option>
            <option value="promoted">Promoted</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Waitlist Table */}
      {isLoading ? (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <LoadingSkeleton height={200} />
          </div>
        </Card>
      ) : error || !waitlist ? (
        <Card style={{ background: '#FFF1F0', border: '1px solid #FFCCC7' }}>
          <div style={{ padding: spacing.lg, color: '#820014' }}>
            Error loading waitlist: {error?.message || 'Unknown error'}
          </div>
        </Card>
      ) : waitlist.length === 0 ? (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No waitlist entries found
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Position</th>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Consumer Name</th>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Mobile</th>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Project</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Unit Type</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Applied Date</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Status</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((entry: WaitlistEntry) => {
                    const statusColor = statusColors[entry.status] || statusColors['waiting'];

                    return (
                      <tr key={entry.id} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                        <td style={{ textAlign: 'center', padding: spacing.md, fontWeight: 600 }}>
                          #{entry.position}
                        </td>
                        <td style={{ padding: spacing.md, fontWeight: 500 }}>
                          {entry.consumer_name}
                        </td>
                        <td style={{ padding: spacing.md, fontFamily: 'monospace', fontSize: '12px' }}>
                          {entry.consumer_mobile}
                        </td>
                        <td style={{ padding: spacing.md }}>{entry.project_name}</td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>{entry.unit_type}</td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {new Date(entry.applied_date).toLocaleDateString('en-IN', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
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
                              textTransform: 'capitalize',
                            }}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {entry.status === 'waiting' ? (
                            <button
                              onClick={() => handleOpenPromoteModal(entry)}
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
                              Promote
                            </button>
                          ) : (
                            <span style={{ color: colors.neutral[600], fontSize: '12px' }}>—</span>
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

      {/* Modals */}
      <PromoteModal
        isOpen={showPromoteModal}
        entry={selectedEntry}
        onClose={handleClosePromoteModal}
        onSubmit={handlePromoteSubmit}
        isLoading={promoteEntry.isPending}
      />

      <AddWaitlistModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddSubmit}
        isLoading={addEntry.isPending}
        projects={projects}
      />
    </div>
  );
}
