import { useAllotmentDashboard } from '../../hooks/useReport';
import { Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

function FillPercentageBadge({ percentage }: { percentage: number }) {
  let bgColor = '#FFE58F'; // Yellow
  let textColor = '#6F4E37';

  if (percentage >= 75) {
    bgColor = '#B7EB8F'; // Green
    textColor = '#274916';
  } else if (percentage < 50) {
    bgColor = '#FFCCC7'; // Red
    textColor = '#820014';
  }

  return (
    <span
      style={{
        padding: '4px 8px',
        borderRadius: '3px',
        background: bgColor,
        color: textColor,
        fontWeight: 600,
        fontSize: '12px',
      }}
    >
      {percentage}%
    </span>
  );
}

export function AllotmentDashboardPage() {
  const { data, isLoading, error } = useAllotmentDashboard();

  if (isLoading) {
    return (
      <div style={{ padding: spacing.lg }}>
        <h1 style={{ marginTop: 0 }}>Allotment Dashboard</h1>
        <LoadingSkeleton height={200} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: spacing.lg }}>
        <h1 style={{ marginTop: 0 }}>Allotment Dashboard</h1>
        <Card style={{ background: '#FFF1F0', border: '1px solid #FFCCC7' }}>
          <div style={{ padding: spacing.lg, color: '#820014' }}>
            Error loading allotment dashboard: {error?.message || 'Unknown error'}
          </div>
        </Card>
      </div>
    );
  }

  const { summary, byProject, byUnitType, waitlistSummary } = data;

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0 }}>Allotment Dashboard</h1>

      {/* Summary Cards */}
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
              {summary.totalApplications}
            </div>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Total Applications
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#52C41A' }}>
              {summary.totalAllotted}
            </div>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Total Allotted
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#F57800' }}>
              {summary.totalWaitlisted}
            </div>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Waitlisted
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#F5222D' }}>
              {summary.totalCancelled}
            </div>
            <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.sm }}>
              Cancelled
            </div>
          </div>
        </Card>
      </div>

      {/* By Project Table */}
      <Card style={{ marginBottom: spacing.lg }}>
        <div style={{ padding: spacing.lg }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
            By Project
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                  <th style={{ textAlign: 'left', padding: spacing.md }}>Project Name</th>
                  <th style={{ textAlign: 'left', padding: spacing.md }}>RERA #</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Total Units</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Applications</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Allotted</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Waitlist</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Cancellations</th>
                  <th style={{ textAlign: 'center', padding: spacing.md }}>Fill %</th>
                </tr>
              </thead>
              <tbody>
                {byProject.map((project: any) => (
                  <tr key={project.projectId} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                    <td style={{ padding: spacing.md }}>{project.projectName}</td>
                    <td style={{ padding: spacing.md, fontFamily: 'monospace', fontSize: '11px' }}>
                      {project.reraNumber || '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{project.totalUnits}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{project.applications}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{project.allotted}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{project.waitlistDepth}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>
                      {project.cancellations} ({(project.cancellationRate || 0).toFixed(1)}%)
                    </td>
                    <td style={{ textAlign: 'center', padding: spacing.md }}>
                      <FillPercentageBadge percentage={project.fillPercentage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* By Unit Type Table */}
      <Card style={{ marginBottom: spacing.lg }}>
        <div style={{ padding: spacing.lg }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
            By Unit Type
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                  <th style={{ textAlign: 'left', padding: spacing.md }}>Project</th>
                  <th style={{ textAlign: 'left', padding: spacing.md }}>BHK Type</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Total Units</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Allotted</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Available</th>
                  <th style={{ textAlign: 'center', padding: spacing.md }}>Fill %</th>
                </tr>
              </thead>
              <tbody>
                {byUnitType.map((unit: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                    <td style={{ padding: spacing.md }}>{unit.projectName || '—'}</td>
                    <td style={{ padding: spacing.md, fontWeight: 500 }}>{unit.bhkType}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{unit.totalUnits}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{unit.allotted}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{unit.available}</td>
                    <td style={{ textAlign: 'center', padding: spacing.md }}>
                      <FillPercentageBadge percentage={unit.fillPercentage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Waitlist Summary Table */}
      <Card>
        <div style={{ padding: spacing.lg }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
            Waitlist Summary
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                  <th style={{ textAlign: 'left', padding: spacing.md }}>Project</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Waitlist Count</th>
                  <th style={{ textAlign: 'left', padding: spacing.md }}>Oldest Entry Date</th>
                </tr>
              </thead>
              <tbody>
                {waitlistSummary.map((item: any) => {
                  const isHighWaitlist = item.waitlistCount > 10;
                  return (
                    <tr
                      key={item.projectId}
                      style={{
                        borderBottom: `1px solid ${colors.neutral[100]}`,
                        background: isHighWaitlist ? '#fffbe6' : 'transparent',
                      }}
                    >
                      <td style={{ padding: spacing.md }}>{item.projectName}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: spacing.md,
                          fontWeight: isHighWaitlist ? 600 : 400,
                          color: isHighWaitlist ? '#6F4E37' : 'inherit',
                        }}
                      >
                        {item.waitlistCount}
                      </td>
                      <td style={{ padding: spacing.md }}>
                        {item.oldestWaitlistDate
                          ? new Date(item.oldestWaitlistDate).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
