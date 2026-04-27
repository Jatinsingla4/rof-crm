import React, { useState } from 'react';
import { useUnits, useInventorySummary, useTowerBreakdown } from '../hooks';
import { DataTable, DashboardKPICard, SearchFilter, Button, Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

export function UnitInventoryPage({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tower, setTower] = useState('');
  const [status, setStatus] = useState('');
  const [bhkType, setBhkType] = useState('');

  const { data: units, isLoading: unitsLoading } = useUnits({
    projectId,
    tower: tower || undefined,
    status: status || undefined,
    bhkType: bhkType || undefined,
    page,
    pageSize: 20,
  });

  const { data: summary, isLoading: summaryLoading } = useInventorySummary(projectId);
  const { data: towerBreakdown, isLoading: towerLoading } = useTowerBreakdown(projectId);

  const statusColorMap: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    available: 'success',
    allotted: 'info',
    cancelled: 'error',
    possession_handed_over: 'success',
  };

  const columns = [
    { id: 'unitNumber', header: 'Unit #', accessorKey: 'unit_number' },
    { id: 'tower', header: 'Tower', accessorKey: 'tower' },
    { id: 'floor', header: 'Floor', accessorKey: 'floor' },
    { id: 'bhkType', header: 'BHK', accessorKey: 'bhk_type' },
    { id: 'carpetArea', header: 'Carpet (sqm)', accessorKey: 'carpet_area_sqm' },
    { id: 'totalPrice', header: 'Total Price (₹)', accessorKey: 'total_price_inr' },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (value: string) => (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: colors[statusColorMap[value] || 'neutral'][50],
            color: colors[statusColorMap[value] || 'neutral'][700],
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {value}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0 }}>Unit Inventory</h1>

      {/* Summary KPIs */}
      {summaryLoading ? (
        <LoadingSkeleton height={150} />
      ) : summary ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <DashboardKPICard
            metric={summary.total_units}
            title="Total Units"
            icon="📦"
            variant="primary"
          />
          <DashboardKPICard
            metric={summary.available}
            title="Available"
            icon="✅"
            variant="success"
          />
          <DashboardKPICard
            metric={summary.allotted}
            title="Allotted"
            icon="🏠"
            variant="info"
          />
          <DashboardKPICard
            metric={`${summary.fill_percentage}%`}
            title="Fill %"
            icon="📊"
            variant="primary"
            trend={{
              value: summary.fill_percentage,
              direction: summary.fill_percentage > 50 ? 'up' : 'down',
            }}
          />
        </div>
      ) : null}

      {/* Filters */}
      <Card style={{ marginBottom: spacing.lg }}>
        <SearchFilter
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          filterOptions={[
            {
              label: 'Tower',
              value: tower,
              onChange: (value) => {
                setTower(value);
                setPage(1);
              },
              options: [
                { label: 'All', value: '' },
                ...((towerBreakdown || []).map((t: any) => ({
                  label: t.tower,
                  value: t.tower,
                }))),
              ],
            },
            {
              label: 'Status',
              value: status,
              onChange: (value) => {
                setStatus(value);
                setPage(1);
              },
              options: [
                { label: 'All', value: '' },
                { label: 'Available', value: 'available' },
                { label: 'Allotted', value: 'allotted' },
                { label: 'Cancelled', value: 'cancelled' },
              ],
            },
            {
              label: 'BHK',
              value: bhkType,
              onChange: (value) => {
                setBhkType(value);
                setPage(1);
              },
              options: [
                { label: 'All', value: '' },
                { label: '1 BHK', value: '1bhk' },
                { label: '2 BHK', value: '2bhk' },
              ],
            },
          ]}
        />
      </Card>

      {/* Units Table */}
      {unitsLoading ? (
        <LoadingSkeleton height={400} />
      ) : units?.data && units.data.length > 0 ? (
        <DataTable
          columns={columns}
          data={units.data}
          selectable
          sortable
          pagination={{
            page,
            pageSize: 20,
            total: units.pagination?.total,
            onPageChange: setPage,
          }}
        />
      ) : (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No units found
          </div>
        </Card>
      )}

      {/* Tower Breakdown */}
      {towerBreakdown && towerBreakdown.length > 0 && (
        <Card style={{ marginTop: spacing.lg }}>
          <h2 style={{ marginTop: 0 }}>Tower-wise Breakdown</h2>
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
                  <th style={{ textAlign: 'left', padding: spacing.md }}>Tower</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Total</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Available</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Allotted</th>
                  <th style={{ textAlign: 'right', padding: spacing.md }}>Fill %</th>
                </tr>
              </thead>
              <tbody>
                {towerBreakdown.map((tower: any) => (
                  <tr
                    key={tower.tower}
                    style={{
                      borderBottom: `1px solid ${colors.neutral[100]}`,
                    }}
                  >
                    <td style={{ padding: spacing.md }}>{tower.tower}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{tower.total_units}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{tower.available}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{tower.allotted}</td>
                    <td style={{ textAlign: 'right', padding: spacing.md }}>{tower.fill_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
