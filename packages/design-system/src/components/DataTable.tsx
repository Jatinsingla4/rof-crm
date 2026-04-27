import React from 'react';
import { colors, spacing, borderRadius } from '../theme';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

/**
 * DataTable Component - Sortable, filterable, paginated table
 * Uses TanStack Table pattern (headless, no styling)
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  onRowClick,
  loading,
  selectable,
  selectedRows = [],
  onSelectionChange,
  sortBy,
  sortOrder = 'asc',
  onSort,
  pagination,
}: DataTableProps<T>) {
  const handleSelectAll = () => {
    if (onSelectionChange) {
      if (selectedRows.length === data.length) {
        onSelectionChange([]);
      } else {
        onSelectionChange(data.map((row) => row[keyField]));
      }
    }
  };

  const handleSelectRow = (id: string) => {
    if (onSelectionChange) {
      const newSelection = selectedRows.includes(id)
        ? selectedRows.filter((rowId) => rowId !== id)
        : [...selectedRows, id];
      onSelectionChange(newSelection);
    }
  };

  return (
    <div style={{ overflow: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${colors.neutral[300]}`, background: colors.neutral[100] }}>
            {selectable && (
              <th style={{ padding: spacing.sm, width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedRows.length === data.length && data.length > 0}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  padding: spacing.sm,
                  textAlign: 'left',
                  fontWeight: 600,
                  color: colors.neutral[800],
                  cursor: column.sortable ? 'pointer' : 'default',
                  width: column.width,
                  userSelect: 'none',
                }}
                onClick={() => {
                  if (column.sortable && onSort) {
                    onSort(column.key);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {column.header}
                  {column.sortable && sortBy === column.key && (
                    sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                style={{ padding: spacing.md, textAlign: 'center', color: colors.neutral[600] }}
              >
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                style={{ padding: spacing.md, textAlign: 'center', color: colors.neutral[600] }}
              >
                No data to display
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const isSelected = selectedRows.includes(row[keyField]);
              return (
                <tr
                  key={row[keyField]}
                  style={{
                    height: '40px',
                    borderBottom: `1px solid ${colors.neutral[200]}`,
                    background: isSelected ? colors.info[50] : idx % 2 === 0 ? '#FFFFFF' : colors.neutral[50],
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 150ms',
                  }}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td style={{ padding: spacing.sm, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(row[keyField])}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} style={{ padding: spacing.sm }}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: spacing.md,
            borderTop: `1px solid ${colors.neutral[300]}`,
            background: '#FFFFFF',
          }}
        >
          <span style={{ fontSize: '12px', color: colors.neutral[600] }}>
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}{' '}
            results
          </span>

          <div style={{ display: 'flex', gap: spacing.xs }}>
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                background: colors.neutral[200],
                border: 'none',
                borderRadius: borderRadius.button,
                cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
                opacity: pagination.page === 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>

            <span style={{ padding: `${spacing.xs} ${spacing.sm}` }}>
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
            </span>

            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              style={{
                padding: `${spacing.xs} ${spacing.sm}`,
                background: colors.neutral[200],
                border: 'none',
                borderRadius: borderRadius.button,
                cursor:
                  pagination.page >= Math.ceil(pagination.total / pagination.pageSize)
                    ? 'not-allowed'
                    : 'pointer',
                opacity: pagination.page >= Math.ceil(pagination.total / pagination.pageSize) ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
