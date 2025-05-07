import React from 'react';
import { Link } from 'react-router-dom';
import { VIOLATIONS_PATH } from '../utils/routeMapper';

export default function ViolationsTable({ violations }) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
            <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {violations.map(v => (
            <tr key={v.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{v.reference}</td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{v.category}</td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{v.building}</td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                {v.created_at ? new Date(v.created_at).toLocaleDateString() : ''}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                <Link to={v.public_id ? `${VIOLATIONS_PATH}/public/${v.public_id}` : `${VIOLATIONS_PATH}/${v.id}`} className="text-blue-600 hover:underline mr-2">View</Link>
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
  );
} 