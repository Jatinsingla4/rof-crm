import { useState, useEffect } from 'react';
import { Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';
import { useMilestones, useProjectProgress, useCompleteMilestone } from '../../hooks/useMilestones';
import { useAllotmentDashboard } from '../../hooks/useReport';

const MILESTONE_TYPE_COLORS: { [key: string]: { bg: string; text: string } } = {
  foundation: { bg: '#FEE7E6', text: '#820014' },
  structure: { bg: '#FCE4EC', text: '#880E4F' },
  finishing: { bg: '#F3E5F5', text: '#4A148C' },
  mep: { bg: '#E3F2FD', text: '#0D47A1' },
  legal: { bg: '#E8F5E9', text: '#1B5E20' },
  handover: { bg: '#FFF3E0', text: '#E65100' },
};

interface CompleteModalProps {
  isOpen: boolean;
  milestone: any | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function CompleteMilestoneModal({
  isOpen,
  milestone,
  onClose,
  onSubmit,
  isLoading,
}: CompleteModalProps) {
  const [actualDate, setActualDate] = useState(
    milestone ? new Date(milestone.planned_date).toISOString().split('T')[0] : ''
  );
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [description, setDescription] = useState('');
  const [notifyAllottees, setNotifyAllottees] = useState(true);

  if (!isOpen || !milestone) return null;

  const handleSubmit = () => {
    onSubmit({
      milestoneId: milestone.id,
      actualDate,
      completionPercentage: Math.min(100, Math.max(0, completionPercentage)),
      description,
      notifyAllottees,
    });
    // Reset form
    setCompletionPercentage(0);
    setDescription('');
    setNotifyAllottees(true);
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
          maxWidth: '500px',
          background: '#FFFFFF',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: spacing.lg }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
            Mark Complete: {milestone.milestone_name}
          </h2>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Actual Completion Date
            </label>
            <input
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
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
              Completion Percentage: {completionPercentage}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={completionPercentage}
              onChange={(e) => setCompletionPercentage(parseInt(e.target.value))}
              style={{
                width: '100%',
              }}
            />
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Progress: {completionPercentage}% complete
            </div>
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Notes / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this milestone completion..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              marginBottom: spacing.lg,
              padding: spacing.md,
              background: '#F0F5FF',
              borderRadius: '4px',
            }}
          >
            <input
              type="checkbox"
              checked={notifyAllottees}
              onChange={(e) => setNotifyAllottees(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label style={{ cursor: 'pointer', fontSize: '14px' }}>
              Notify all allottees of this update
            </label>
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
              disabled={isLoading || !actualDate}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: '#52C41A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading || !actualDate ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                opacity: isLoading || !actualDate ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Saving...' : 'Mark Complete'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function MilestonesPage() {
  const { data: allotmentData } = useAllotmentDashboard();
  const projects = allotmentData?.byProject || [];

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedMilestone, setSelectedMilestone] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Set initial project when data loads
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].projectId);
    }
  }, [projects]);

  const { data: milestones, isLoading: milestonesLoading, error: milestonesError } = useMilestones(
    selectedProjectId
  );
  const { data: progress, isLoading: progressLoading } = useProjectProgress(selectedProjectId);
  const completeMilestone = useCompleteMilestone();

  const handleOpenModal = (milestone: any) => {
    setSelectedMilestone(milestone);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedMilestone(null);
  };

  const handleCompleteSubmit = async (data: any) => {
    try {
      await completeMilestone.mutateAsync(data);
      handleCloseModal();
    } catch (error) {
      console.error('Error completing milestone:', error);
    }
  };

  const projectName = projects.find((p: any) => p.projectId === selectedProjectId)?.projectName || 'Project';

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0, marginBottom: spacing.lg }}>Construction Progress</h1>

      {/* Project Selector */}
      <Card style={{ marginBottom: spacing.lg }}>
        <div style={{ padding: spacing.lg }}>
          <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
            Select Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedMilestone(null);
              setShowModal(false);
            }}
            style={{
              width: '100%',
              padding: spacing.sm,
              border: `1px solid ${colors.neutral[300]}`,
              borderRadius: '4px',
              fontSize: '14px',
              background: '#FFFFFF',
            }}
          >
            {projects.map((project: any) => (
              <option key={project.projectId} value={project.projectId}>
                {project.projectName} ({project.reraNumber || 'N/A'})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Progress Bar Section */}
      {progressLoading ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <div style={{ padding: spacing.lg }}>
            <LoadingSkeleton height={60} />
          </div>
        </Card>
      ) : progress ? (
        <Card
          style={{
            marginBottom: spacing.lg,
            background: '#F0F5FF',
            border: '1px solid #BAE7FF',
          }}
        >
          <div style={{ padding: spacing.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Overall Progress</h2>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1890FF' }}>
                {(Number(progress?.progressPercentage) || 0).toFixed(1)}%
              </div>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '24px',
                background: colors.neutral[200],
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: spacing.md,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Number(progress?.progressPercentage) || 0}%`,
                  background: '#1890FF',
                  transition: 'width 300ms ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {(Number(progress?.progressPercentage) || 0) > 5
                  ? `${Math.round(Number(progress?.completedMilestones) || 0)} of ${Number(progress?.totalMilestones) || 0}`
                  : ''}
              </div>
            </div>

            <div style={{ fontSize: '13px', color: colors.neutral[700] }}>
              {Number(progress?.completedMilestones) || 0} of {Number(progress?.totalMilestones) || 0} milestones completed
            </div>
          </div>
        </Card>
      ) : null}

      {/* Milestones List */}
      {milestonesLoading ? (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <LoadingSkeleton height={200} />
          </div>
        </Card>
      ) : milestonesError || !milestones ? (
        <Card style={{ background: '#FFF1F0', border: '1px solid #FFCCC7' }}>
          <div style={{ padding: spacing.lg, color: '#820014' }}>
            Error loading milestones: {milestonesError?.message || 'Unknown error'}
          </div>
        </Card>
      ) : milestones.length === 0 ? (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No milestones found for this project
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
              Milestones
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Milestone</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Type</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Planned Date</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Actual Date</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Status</th>
                    <th style={{ textAlign: 'right', padding: spacing.md }}>Completion %</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((milestone: any) => {
                    const typeColor = MILESTONE_TYPE_COLORS[milestone.milestone_type] || {
                      bg: colors.neutral[100],
                      text: colors.neutral[800],
                    };
                    const statusColor =
                      milestone.status === 'completed'
                        ? { bg: '#E6FFED', text: '#274916' }
                        : { bg: '#FFF1F0', text: '#820014' };

                    return (
                      <tr key={milestone.id} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                        <td style={{ padding: spacing.md, fontWeight: 500 }}>
                          {milestone.milestone_name}
                          {milestone.description && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: colors.neutral[600],
                                marginTop: spacing.xs,
                              }}
                            >
                              {milestone.description}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              background: typeColor.bg,
                              color: typeColor.text,
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          >
                            {milestone.milestone_type}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {milestone.planned_date
                            ? new Date(milestone.planned_date).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {milestone.actual_date
                            ? new Date(milestone.actual_date).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
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
                            {milestone.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', padding: spacing.md, fontWeight: 600 }}>
                          {milestone.completion_percentage ?? 0}%
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {milestone.status !== 'completed' ? (
                            <button
                              onClick={() => handleOpenModal(milestone)}
                              style={{
                                padding: '4px 12px',
                                background: '#1890FF',
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
      <CompleteMilestoneModal
        isOpen={showModal}
        milestone={selectedMilestone}
        onClose={handleCloseModal}
        onSubmit={handleCompleteSubmit}
        isLoading={completeMilestone.isPending}
      />
    </div>
  );
}
