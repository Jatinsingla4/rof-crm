import { useSalesDashboard, useFinancialDashboard } from '../../hooks';
import { Card, colors, spacing } from '@rof-crm/design-system';

/**
 * Dashboard Page
 * Displays key metrics and charts
 * Sales Dashboard + Financial Dashboard + Project Dashboard
 * Real data from backend API (GET /api/reports/sales-dashboard, GET /api/reports/financial-dashboard)
 */
export function DashboardPage() {
  const salesDashboard = useSalesDashboard();
  const financialDashboard = useFinancialDashboard();

  const formatCurrency = (value: number | bigint) => {
    const num = typeof value === 'bigint' ? Number(value) : value;
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(1)}Cr`;
    } else if (num >= 100000) {
      return `₹${(num / 100000).toFixed(0)}L`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const renderKpiCard = (
    title: string,
    value: string | number | null | undefined,
    subtitle: string | React.ReactNode,
    isLoading: boolean,
    isError?: boolean,
    subtitleColor: string = colors.neutral[600]
  ) => (
    <Card variant="elevated" padding="spacious">
      <div style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '4px' }}>
        {isError ? '—' : isLoading ? 'Loading...' : value ?? 'No data'}
      </div>
      <div style={{ fontSize: '14px', color: subtitleColor }}>{isLoading ? '...' : subtitle}</div>
    </Card>
  );

  // Calculate conversion rate percentage
  const totalLeads = salesDashboard.data?.total_leads ?? 0;
  const allottedCount = salesDashboard.data?.allotted ?? 0;
  const allottedPercentage = totalLeads > 0 ? Math.round((allottedCount / totalLeads) * 100) : 0;

  // Handle loading and error states
  const isLoadingSales = salesDashboard.isLoading;
  const isLoadingFinancial = financialDashboard.isLoading;
  const isSalesError = salesDashboard.isError;
  const isFinancialError = financialDashboard.isError;

  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Dashboard</h1>

      {/* Error state banner */}
      {(isSalesError || isFinancialError) && (
        <Card variant="outlined" padding="standard" style={{ marginBottom: spacing.lg, borderColor: colors.error[300], backgroundColor: '#fff5f5' }}>
          <div style={{ fontSize: '14px', color: colors.error[600] }}>
            <strong>⚠ Failed to load dashboard data.</strong> Please refresh the page or try again later.
          </div>
        </Card>
      )}

      {/* KPI Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        {/* Total Applications - from sales-dashboard */}
        {renderKpiCard(
          'Total Applications',
          totalLeads > 0 ? totalLeads.toLocaleString('en-IN') : 'No data',
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {totalLeads > 0 ? `${allottedPercentage}% allotted` : 'Add consumers to get started'}
          </span>,
          isLoadingSales,
          isSalesError,
          totalLeads > 0 ? colors.neutral[600] : colors.neutral[500]
        )}

        {/* Allotted Units - from sales-dashboard */}
        {renderKpiCard(
          'Allotted Units',
          allottedCount > 0 ? allottedCount.toLocaleString('en-IN') : 'No data',
          <span>
            {allottedCount > 0 ? `${allottedPercentage}% of total` : 'No allotments yet'}
          </span>,
          isLoadingSales,
          isSalesError,
          allottedCount > 0 ? colors.neutral[600] : colors.neutral[500]
        )}

        {/* Outstanding Amount - from financial-dashboard */}
        {renderKpiCard(
          'Outstanding Amount',
          financialDashboard.data?.outstanding ? formatCurrency(financialDashboard.data.outstanding) : 'No data',
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {financialDashboard.data?.collectionPercentage ? `${financialDashboard.data.collectionPercentage}% collected` : 'No payments yet'}
          </span>,
          isLoadingFinancial,
          isFinancialError,
          financialDashboard.data?.outstanding ? colors.warning[500] : colors.neutral[500]
        )}

        {/* Overdue Amount - from financial-dashboard */}
        {renderKpiCard(
          'Overdue Demands',
          financialDashboard.data?.overdue_count ?? 'No data',
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {financialDashboard.data?.overdue_count ? `${financialDashboard.data.overdue_count} pending` : 'No overdue'}
          </span>,
          isLoadingFinancial,
          isFinancialError,
          financialDashboard.data?.overdue_count && financialDashboard.data.overdue_count > 0 ? colors.error[500] : colors.neutral[600]
        )}
      </div>

      {/* Charts placeholder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
        <Card variant="elevated">
          <div style={{ padding: spacing.md }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.md }}>
              Pipeline Funnel
            </h3>
            <div style={{ height: '300px', background: colors.neutral[100], borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isLoadingSales ? (
                <span style={{ color: colors.neutral[400] }}>Loading chart data...</span>
              ) : totalLeads === 0 ? (
                <span style={{ color: colors.neutral[400] }}>No data available</span>
              ) : (
                <span style={{ color: colors.neutral[400] }}>Chart will be rendered here</span>
              )}
            </div>
          </div>
        </Card>

        <Card variant="elevated">
          <div style={{ padding: spacing.md }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.md }}>
              Collection Efficiency
            </h3>
            <div style={{ height: '300px', background: colors.neutral[100], borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isLoadingFinancial ? (
                <span style={{ color: colors.neutral[400] }}>Loading chart data...</span>
              ) : !financialDashboard.data?.total_receivables ? (
                <span style={{ color: colors.neutral[400] }}>No data available</span>
              ) : (
                <span style={{ color: colors.neutral[400] }}>Chart will be rendered here</span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
