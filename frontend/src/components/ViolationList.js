import React, { useEffect, useState } from 'react';
import API from '../api';
import { Link } from 'react-router-dom';

export default function ViolationList() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [dateFilter, setDateFilter] = useState('');

  const fetchViolations = () => {
    setLoading(true);
    let url = `/api/violations?page=${page}&per_page=${perPage}`;
    if (dateFilter) {
      url += `&date_filter=${dateFilter}`;
    }

    API.get(url)
      .then(res => {
        if (res.data.violations) {
          setViolations(res.data.violations);
          setTotalPages(res.data.pagination.pages);
          setTotalItems(res.data.pagination.total);
        } else {
          // Handle old API format in case server hasn't been updated
          setViolations(res.data || []);
        }
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load violations');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchViolations();
  }, [page, perPage, dateFilter]);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handlePerPageChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setPerPage(value);
    setPage(1); // Reset to first page when changing items per page
  };

  const handleDateFilterChange = (value) => {
    setDateFilter(value);
    setPage(1); // Reset to first page when changing filter
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!violations.length) return <div className="p-4">No violations found matching the current filters.</div>;

  // Collect all dynamic field names for table headers (limit to common fields)
  const dynamicFieldNames = Array.from(
    new Set(
      violations.flatMap(v => Object.keys(v.dynamic_fields || {}))
    )
  ).slice(0, 3); // Limit to first 3 dynamic fields to save space

  // Update links to use public_id
  const generateLink = (violation) => {
    if (violation.public_id) {
      return `/violations/public/${violation.public_id}`;
    }
    return `/violations/${violation.id}`;
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Violations</h2>
      
      {/* Filters and Controls */}
      <div className="flex flex-wrap justify-between mb-4 items-center">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center">
            <label htmlFor="dateFilter" className="mr-2 text-sm font-medium">Date Filter:</label>
            <select
              id="dateFilter"
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">All Time</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
            </select>
          </div>
          
          <div className="flex items-center ml-4">
            <label htmlFor="perPage" className="mr-2 text-sm font-medium">Show:</label>
            <select
              id="perPage"
              value={perPage}
              onChange={handlePerPageChange}
              className="border rounded px-2 py-1 text-sm bg-blue-100 font-bold"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          Showing {violations.length} of {totalItems} violations
        </div>
      </div>
      
      {/* Violations Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              {dynamicFieldNames.map(name => (
                <th key={name} scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{name}</th>
              ))}
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {violations.map(v => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  <Link to={generateLink(v)} className="text-blue-600 hover:underline">
                    {v.reference}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{v.dynamic_fields?.Category || v.category}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{v.building}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                  {v.created_at ? new Date(v.created_at).toLocaleDateString() : ''}
                </td>
                {dynamicFieldNames.map(name => (
                  <td key={name} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{v.dynamic_fields?.[name] || ''}</td>
                ))}
                <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                  {v.html_path && 
                    <a href={v.html_path} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline mr-2">HTML</a>
                  }
                  {v.pdf_path && 
                    <a href={v.pdf_path} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">PDF</a>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4 gap-2">
          <button
            onClick={() => handlePageChange(1)}
            disabled={page === 1}
            className={`inline-flex items-center px-3 py-1 border rounded-md text-sm ${page === 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            First
          </button>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className={`inline-flex items-center px-3 py-1 border rounded-md text-sm ${page === 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Previous
          </button>
          
          <span className="inline-flex items-center px-3 py-1 text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className={`inline-flex items-center px-3 py-1 border rounded-md text-sm ${page === totalPages ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Next
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={page === totalPages}
            className={`inline-flex items-center px-3 py-1 border rounded-md text-sm ${page === totalPages ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
} 