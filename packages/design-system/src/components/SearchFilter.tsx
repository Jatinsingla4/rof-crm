import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { colors, spacing, borderRadius } from '../theme';

export interface SearchFilterProps {
  onSearch: (query: string) => void;
  onFilterClick?: () => void;
  placeholder?: string;
}

/**
 * SearchFilter Component - Quick search + advanced filter panel
 * Search bar with prefix icon, filter button
 */
export function SearchFilter({
  onSearch,
  onFilterClick,
  placeholder = 'Search...',
}: SearchFilterProps) {
  const [query, setQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  return (
    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: spacing.sm,
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.neutral[600],
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          style={{
            width: '100%',
            height: '40px',
            paddingLeft: '36px',
            paddingRight: spacing.sm,
            border: `1px solid ${colors.neutral[300]}`,
            borderRadius: borderRadius.card,
            fontSize: '14px',
            transition: 'all 150ms',
          }}
        />
      </div>

      {onFilterClick && (
        <button
          onClick={onFilterClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: `${spacing.xs} ${spacing.sm}`,
            background: colors.neutral[100],
            border: `1px solid ${colors.neutral[300]}`,
            borderRadius: borderRadius.button,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 150ms',
          }}
        >
          Filter
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
}
