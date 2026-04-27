import React, { useState } from 'react';
import {
  useSalesDashboard,
  useFinancialDashboard,
  useProjectDashboard,
  useCampaignRoi,
  useLeadSourceAnalysis,
  usePaymentAgeing,
  useMonthlyCollection,
} from '../hooks';
import { DashboardKPICard, Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

// Simple chart implementations (Recharts would require dependency)
function SimpleBarChart({ data, title }: { data: any[]; title: string }) {
  return (
    <Card>
      <h3>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
              <th style={{ textAlign: 'left', padding: spacing.md }}>Category</th>
              <th style={{ textAlign: 'right', padding: spacing.md }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                <td style={{ padding: spacing.md }}>{Object.keys(item)[0]}</td>
                <td style={{ textAlign: 'right', padding: spacing.md }}>
                  {Object.values(item)[0]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SimpleLineChart({ data, title, seriesKey }: { data: any[]; title: string; seriesKey: string }) {
  return (
    <Card>
      <h3>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
              <th style={{ textAlign: 'left', padding: spacing.md }}>Date</th>
              <th style={{ textAlign: 'right', padding: spacing.md }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                <td style={{ padding: spacing.md }}>
                  {typeof item.month === 'string' ? item.month.split('T')[0] : item.month}
                </td>
                <td style={{ textAlign: 'right', padding: spacing.md }}>
                  ₹{(item[seriesKey] / 100000).toFixed(1)}L
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ReportsDashboardPage({ projectId }: { projectId: string }) {
  const [dashboardTab, setDashboardTab] = useState<'sales' | 'financial' | 'project' | 'custom'>('sales');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  // Fetch dashboard data
  const { data: salesData, isLoading: salesLoading } = useSalesDashboard({
    projectId,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const { data: financialData, isLoading: financialLoading } = useFinancialDashboard(projectId);
  const { data: projectData, isLoading: projectLoading } = useProjectDashboard(projectId);
  const { data: roiData, isLoading: roiLoading } = useCampaignRoi({ projectId });
  const { data: leadSourceData, isLoading: leadSourceLoading } = useLeadSourceAnalysis(projectId);
  const { data: paymentAgeingData, isLoading: paymentAgeingLoading } = usePaymentAgeing(projectId);
  const { data: collectionTrendData, isLoading: collectionTrendLoading } = useMonthlyCollection(projectId);

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0 }}>Reports & Analytics</h1>

      {/* Date Range Filter */}
      <Card style={{ marginBottom: spacing.lg }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.md, alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', marginBottom: spacing.sm }}>From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              style={{
                width: '100%',
                padding: spacing.md,
                borderRadius: 6,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing.sm }}>To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              style={{
                width: '100%',
                padding: spacing.md,
                borderRadius: 6,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>
        </div>
      </Card>

      {/* Dashboard Tabs */}
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          marginBottom: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[200]}`,
        }}
      >
        {(['sales', 'financial', 'project', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDashboardTab(tab)}
            style={{
              padding: `${spacing.md} ${spacing.lg}`,
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: dashboardTab === tab ? `2px solid ${colors.primary[600]}` : 'none',
              color: dashboardTab === tab ? colors.primary[600] : colors.neutral[600],
              fontWeight: dashboardTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {tab === 'sales' && 'Sales'}
            {tab === 'financial' && 'Financial'}
            {tab === 'project' && 'Project'}
            {tab === 'custom' && 'Custom Reports'}
          </button>
        ))}
      </div>

      {/* Sales Dashboard */}
      {dashboardTab === 'sales' && (
        <>
          {salesLoading ? (
            <LoadingSkeleton height={200} />
          ) : salesData ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: spacing.md,
                  marginBottom: spacing.lg,
                }}
              >
                <DashboardKPICard
                  metric={salesData.total_leads}
                  title="Total Leads"
                  icon="📊"
                  variant="primary"
                />
                <DashboardKPICard
                  metric={salesData.enquiry_stage}
                  title="Enquiry Stage"
                  icon="❓"
                  variant="info"
                />
                <DashboardKPICard
                  metric={salesData.allotted}
                  title="Allotted"
                  icon="✅"
                  variant="success"
                />
                <DashboardKPICard
                  metric={`${salesData.conversion_rate}%`}
                  title="Conversion Rate"
                  icon="🎯"
                  variant="primary"
                  trend={{
                    value: salesData.conversion_rate,
                    direction: 'up',
                  }}
                />
              </div>

              <SimpleBarChart
                data={[
                  { 'Enquiry': salesData.enquiry_stage },
                  { 'Interested': salesData.interested_stage },
                  { 'Application Filed': salesData.application_filed },
                  { 'Draw Entered': salesData.draw_entered },
                  { 'Allotted': salesData.allotted },
                  { 'Cancelled': salesData.cancelled },
                ]}
                title="Sales Pipeline Breakdown"
              />
            </>
          ) : null}
        </>
      )}

      {/* Financial Dashboard */}
      {dashboardTab === 'financial' && (
        <>
          {financialLoading ? (
            <LoadingSkeleton height={200} />
          ) : financialData ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: spacing.md,
                  marginBottom: spacing.lg,
                }}
              >
                <DashboardKPICard
                  metric={`₹${(financialData.totalReceivables / 100000).toFixed(1)}L`}
                  title="Total Receivables"
                  icon="💰"
                  variant="primary"
                />
                <DashboardKPICard
                  metric={`₹${(financialData.totalCollected / 100000).toFixed(1)}L`}
                  title="Total Collected"
                  icon="✅"
                  variant="success"
                  trend={{
                    value: financialData.collectionPercentage,
                    direction: 'up',
                  }}
                />
                <DashboardKPICard
                  metric={`${financialData.collectionPercentage}%`}
                  title="Collection Rate"
                  icon="📈"
                  variant="info"
                />
                <DashboardKPICard
                  metric={`₹${(financialData.outstanding / 100000).toFixed(1)}L`}
                  title="Outstanding"
                  icon="⚠️"
                  variant="error"
                />
              </div>

              {collectionTrendData && (
                <SimpleLineChart
                  data={collectionTrendData}
                  title="Monthly Collection Trend"
                  seriesKey="amount_collected_inr"
                />
              )}

              {paymentAgeingData && (
                <SimpleBarChart
                  data={paymentAgeingData.map((item: any) => ({
                    [item.ageing_bucket]: item.total_due_inr,
                  }))}
                  title="Payment Ageing Analysis"
                />
              )}
            </>
          ) : null}
        </>
      )}

      {/* Project Dashboard */}
      {dashboardTab === 'project' && (
        <>
          {projectLoading ? (
            <LoadingSkeleton height={200} />
          ) : projectData ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: spacing.md,
                  marginBottom: spacing.lg,
                }}
              >
                <DashboardKPICard
                  metric={projectData.inventory.total_units}
                  title="Total Units"
                  icon="🏠"
                  variant="primary"
                />
                <DashboardKPICard
                  metric={projectData.inventory.available}
                  title="Available"
                  icon="✅"
                  variant="success"
                />
                <DashboardKPICard
                  metric={projectData.inventory.allotted}
                  title="Allotted"
                  icon="👤"
                  variant="info"
                />
                <DashboardKPICard
                  metric={`${projectData.inventory.fill_percentage}%`}
                  title="Fill Rate"
                  icon="📊"
                  variant="primary"
                  trend={{
                    value: projectData.inventory.fill_percentage,
                    direction: 'up',
                  }}
                />
              </div>

              <div style={{ marginTop: spacing.lg }}>
                <h3>Payment Collection Status</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: spacing.md,
                  }}
                >
                  <DashboardKPICard
                    metric={`₹${(projectData.payment.total_receivables / 100000).toFixed(1)}L`}
                    title="Total Receivables"
                    icon="💰"
                    variant="primary"
                  />
                  <DashboardKPICard
                    metric={`${projectData.payment.collectionPercentage}%`}
                    title="Collection %"
                    icon="📈"
                    variant="success"
                  />
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* Custom Reports */}
      {dashboardTab === 'custom' && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: spacing.lg,
            }}
          >
            {roiLoading ? (
              <LoadingSkeleton height={200} />
            ) : roiData && roiData.length > 0 ? (
              <Card>
                <h3>Campaign ROI Analysis</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                        <th style={{ textAlign: 'left', padding: spacing.sm }}>Campaign</th>
                        <th style={{ textAlign: 'right', padding: spacing.sm }}>ROI %</th>
                        <th style={{ textAlign: 'right', padding: spacing.sm }}>Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roiData.map((item: any) => (
                        <tr key={item.campaign_id} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                          <td style={{ padding: spacing.sm }}>{item.campaign_type}</td>
                          <td style={{ textAlign: 'right', padding: spacing.sm }}>
                            <span
                              style={{
                                color: item.roi_percentage > 0 ? colors.success[600] : colors.error[600],
                                fontWeight: 600,
                              }}
                            >
                              {item.roi_percentage}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: spacing.sm }}>
                            {item.total_leads_generated}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {leadSourceLoading ? (
              <LoadingSkeleton height={200} />
            ) : leadSourceData && leadSourceData.length > 0 ? (
              <Card>
                <h3>Lead Source Analysis</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                        <th style={{ textAlign: 'left', padding: spacing.sm }}>Source</th>
                        <th style={{ textAlign: 'right', padding: spacing.sm }}>Leads</th>
                        <th style={{ textAlign: 'right', padding: spacing.sm }}>Conv %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadSourceData.map((item: any) => (
                        <tr key={item.lead_source} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                          <td style={{ padding: spacing.sm }}>{item.lead_source}</td>
                          <td style={{ textAlign: 'right', padding: spacing.sm }}>{item.total_leads}</td>
                          <td style={{ textAlign: 'right', padding: spacing.sm }}>{item.conversion_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
