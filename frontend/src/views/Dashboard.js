import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../api";

// Components
const StatCard = ({ title, value, icon, color }) => (
  <div className="relative flex flex-col min-w-0 break-words bg-white rounded mb-6 xl:mb-0 shadow-lg">
    <div className="flex-auto p-4">
      <div className="flex flex-wrap">
        <div className="relative w-full pr-4 max-w-full flex-grow flex-1">
          <h5 className="text-blueGray-400 uppercase font-bold text-xs">
            {title}
          </h5>
          <span className="font-semibold text-xl text-blueGray-700">
            {value}
          </span>
        </div>
        <div className="relative w-auto pl-4 flex-initial">
          <div className={`text-white p-3 text-center inline-flex items-center justify-center w-12 h-12 shadow-lg rounded-full ${color}`}>
            <i className={icon}></i>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const RecentViolationsTable = ({ violations }) => (
  <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded">
    <div className="rounded-t mb-0 px-4 py-3 border-0">
      <div className="flex flex-wrap items-center">
        <div className="relative w-full px-4 max-w-full flex-grow flex-1">
          <h3 className="font-semibold text-lg text-blueGray-700">
            Recent Violations
          </h3>
        </div>
      </div>
    </div>
    <div className="block w-full overflow-x-auto">
      <table className="items-center w-full bg-transparent border-collapse">
        <thead>
          <tr>
            <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
              Reference
            </th>
            <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
              Category
            </th>
            <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
              Date
            </th>
            <th className="px-6 align-middle border border-solid py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left bg-blueGray-50 text-blueGray-500 border-blueGray-100">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {violations.map((violation) => (
            <tr key={violation.id}>
              <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                {violation.reference}
              </td>
              <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                {violation.category}
              </td>
              <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                {new Date(violation.created_at).toLocaleDateString()}
              </td>
              <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                <i className="fas fa-circle text-emerald-500 mr-2"></i> Active
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalViolations: 0,
    activeViolations: 0,
    resolvedViolations: 0
  });
  const [recentViolations, setRecentViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return; // Don't fetch if not authenticated
      
      setLoading(true);
      setError(null);
      
      try {
        const [statsResponse, violationsResponse] = await Promise.all([
          API.get('/api/stats'),
          API.get('/api/violations?limit=5')
        ]);
        
        setStats(statsResponse.data);
        setRecentViolations(violationsResponse.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchDashboardData();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="px-4 md:px-10 mx-auto w-full">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-lightBlue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 md:px-10 mx-auto w-full">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative md:pt-32 pb-32 pt-12">
        <div className="px-4 md:px-10 mx-auto w-full">
          <div>
            <div className="flex flex-wrap">
              <div className="w-full lg:w-6/12 xl:w-4/12 px-4">
                <StatCard
                  title="Total Violations"
                  value={stats.totalViolations}
                  icon="fas fa-chart-bar"
                  color="bg-red-500"
                />
              </div>
              <div className="w-full lg:w-6/12 xl:w-4/12 px-4">
                <StatCard
                  title="Active Violations"
                  value={stats.activeViolations}
                  icon="fas fa-exclamation-circle"
                  color="bg-orange-500"
                />
              </div>
              <div className="w-full lg:w-6/12 xl:w-4/12 px-4">
                <StatCard
                  title="Resolved Violations"
                  value={stats.resolvedViolations}
                  icon="fas fa-check-circle"
                  color="bg-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 md:px-10 mx-auto w-full -m-24">
        <div className="flex flex-wrap">
          <div className="w-full mb-12 xl:mb-0 px-4">
            <RecentViolationsTable violations={recentViolations} />
          </div>
        </div>
      </div>
    </>
  );
} 