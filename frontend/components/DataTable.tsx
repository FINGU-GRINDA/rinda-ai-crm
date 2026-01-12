import React, { useState, useMemo } from 'react';
import { IconArrowUp, IconArrowDown, IconCheck, IconTrash } from './Icons';

export interface TableColumn<T> {
  id: string;
  label: string;
  width: number | string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedRows?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  emptyMessage?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedRows = new Set(),
  onSelectionChange,
  emptyMessage = '데이터가 없습니다',
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      // Simple string comparison for now
      const aVal = String(keyExtractor(a));
      const bVal = String(keyExtractor(b));

      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }, [data, sortColumn, sortDirection, keyExtractor]);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedRows.size === data.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(keyExtractor)));
    }
  };

  const handleSelectRow = (rowId: string) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedRows);
    if (newSelection.has(rowId)) {
      newSelection.delete(rowId);
    } else {
      newSelection.add(rowId);
    }
    onSelectionChange(newSelection);
  };

  const isAllSelected = data.length > 0 && selectedRows.size === data.length;
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < data.length;

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg border border-neutral-200 overflow-hidden">
      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-neutral-50 sticky top-0 z-10">
            <tr>
              {/* Selection Column */}
              {onSelectionChange && (
                <th className="w-12 px-4 py-3 text-left border-b border-neutral-200">
                  <button
                    onClick={handleSelectAll}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isAllSelected
                        ? 'bg-blue-600 border-blue-600'
                        : isSomeSelected
                        ? 'bg-blue-600 border-blue-600 opacity-50'
                        : 'border-neutral-300 hover:border-blue-600'
                    }`}
                    aria-label="전체 선택"
                  >
                    {(isAllSelected || isSomeSelected) && (
                      <IconCheck className="w-3 h-3 text-white" />
                    )}
                  </button>
                </th>
              )}

              {/* Data Columns */}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left border-b border-neutral-200"
                  style={{ width: column.width }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                      {column.label}
                    </span>
                    {column.sortable && (
                      <button
                        onClick={() => handleSort(column.id)}
                        className="text-neutral-400 hover:text-neutral-600 transition-colors"
                        aria-label={`${column.label} 정렬`}
                      >
                        {sortColumn === column.id ? (
                          sortDirection === 'asc' ? (
                            <IconArrowUp className="w-4 h-4" />
                          ) : (
                            <IconArrowDown className="w-4 h-4" />
                          )
                        ) : (
                          <IconArrowDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                  className="px-4 py-12 text-center text-neutral-400 text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const rowId = keyExtractor(row);
                const isSelected = selectedRows.has(rowId);

                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-neutral-100 transition-colors ${
                      onRowClick ? 'cursor-pointer hover:bg-neutral-50' : ''
                    } ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {/* Selection Column */}
                    {onSelectionChange && (
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRow(rowId);
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-neutral-300 hover:border-blue-600'
                          }`}
                          aria-label="행 선택"
                        >
                          {isSelected && <IconCheck className="w-3 h-3 text-white" />}
                        </button>
                      </td>
                    )}

                    {/* Data Columns */}
                    {columns.map((column) => (
                      <td key={column.id} className="px-4 py-3 text-sm text-neutral-700">
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
