import React from 'react';
import ViolationsTable from './ViolationsTable';
import PaginationControls from './PaginationControls';
import useViolationList from '../hooks/useViolationList';

export default function ViolationList() {
  const {
    violations,
    loading,
    error,
    page,
    perPage,
    totalPages,
    totalItems,
    dateFilter,
    handlePageChange,
    handlePerPageChange,
    handleDateFilterChange
  } = useViolationList();

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!violations.length) return <div className="p-4">No violations found matching the current filters.</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Violations</h2>
      {/* Filters and Controls */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <div className="flex items-center">
          <label htmlFor="dateFilter" className="mr-2 text-sm font-medium">Date Filter:</label>
          <div style={{position: 'relative', width: '120px'}}>
            <select
              id="dateFilter"
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                backgroundColor: 'white',
                cursor: 'pointer',
                paddingRight: '2rem',
                backgroundImage: 'none', // This removes the default arrow
                outline: 'none'
              }}
            >
              <option value="">All Time</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
            </select>
            <div style={{
              position: 'absolute',
              top: '50%',
              right: '0.75rem',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#4b5563'
            }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <label htmlFor="perPage" className="mr-2 text-sm font-medium">Show:</label>
          <div style={{position: 'relative', width: '80px'}}>
            <select
              id="perPage"
              value={perPage}
              onChange={handlePerPageChange}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '0.25rem',
                backgroundColor: 'white',
                cursor: 'pointer',
                paddingRight: '2rem',
                backgroundImage: 'none', // This removes the default arrow
                outline: 'none'
              }}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <div style={{
              position: 'absolute',
              top: '50%',
              right: '0.75rem',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#4b5563'
            }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Showing {violations.length} of {totalItems} violations
        </div>
      </div>
      <ViolationsTable violations={violations} />
      <PaginationControls page={page} totalPages={totalPages} handlePageChange={handlePageChange} />
    </div>
  );
} 