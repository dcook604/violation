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
          <div className="relative">
            <select
              id="dateFilter"
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="appearance-none bg-white border rounded px-3 py-1 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Time</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <label htmlFor="perPage" className="mr-2 text-sm font-medium">Show:</label>
          <div className="relative">
            <select
              id="perPage"
              value={perPage}
              onChange={handlePerPageChange}
              className="appearance-none bg-white border rounded px-3 py-1 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
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