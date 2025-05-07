import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../api';
import "@fortawesome/fontawesome-free/css/all.min.css";
import logo from '../../assets/images/spectrum4-logo.png';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Fixed obfuscated route paths
  const dashboardPath = '/r/d5f8a61b2e4c';
  const violationsPath = '/r/7a9c3b5d2f1e';
  const violationsNewPath = '/r/e8f2c1d5a6b3';
  const unitsPath = '/r/b4d6e8f2a1c3';
  const adminUsersPath = '/r/c3a5b7d9e1f2';
  const adminSettingsPath = '/r/a1b3c5d7e9f2';
  
  // Helper function to check if a path is active
  const isActive = (path) => {
    // Check if current location matches the path or starts with it
    return location.pathname === path || 
           (path !== '/' && location.pathname.startsWith(path));
  };
  
  // Function to determine active nav item classes
  const getNavItemClasses = (path) => {
    const baseClasses = "px-3 py-4 lg:py-2 flex items-center text-xs uppercase font-bold transition-all duration-200";
    const inactiveClasses = "hover:text-blueGray-500 text-blueGray-700";
    const activeClasses = "text-blue-600 bg-blue-50 shadow-md rounded-md border-l-4 border-blue-500";
    
    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  const handleLogout = async () => {
    try {
      await API.post('/api/auth/logout');
      logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      <nav className="top-0 fixed z-50 w-full flex flex-wrap items-center justify-between px-2 py-3 navbar-expand-lg bg-white shadow">
        <div className="container px-4 mx-auto flex flex-wrap items-center justify-between">
          <div className="w-full relative flex justify-between lg:w-auto lg:static lg:block lg:justify-start">
            <Link
              to="/"
              className="text-blueGray-700 text-sm font-bold leading-relaxed inline-block mr-4 py-2 whitespace-nowrap uppercase"
            >
              Spectrum 4 Violation System
            </Link>
          </div>
          {user && (
            <div className="lg:flex flex-grow items-center bg-white lg:bg-opacity-0 lg:shadow-none">
              <ul className="flex flex-col lg:flex-row list-none mr-auto">
                <li className="flex items-center">
                  <Link
                    to={dashboardPath}
                    className={getNavItemClasses(dashboardPath)}
                  >
                    <i className="fas fa-tv text-blueGray-400 mr-2 text-lg"></i>
                    Dashboard
                  </Link>
                </li>
                <li className="flex items-center">
                  <Link
                    to={unitsPath}
                    className={getNavItemClasses(unitsPath)}
                  >
                    <i className="fas fa-building text-blueGray-400 mr-2 text-lg"></i>
                    Unit Profiles
                  </Link>
                </li>
                <li className="flex items-center">
                  <Link
                    to={violationsPath}
                    className={getNavItemClasses(violationsPath)}
                  >
                    <i className="fas fa-exclamation-triangle text-blueGray-400 mr-2 text-lg"></i>
                    Violations
                  </Link>
                </li>
                <li className="flex items-center">
                  <Link
                    to={violationsNewPath}
                    className={getNavItemClasses(violationsNewPath)}
                  >
                    <i className="fas fa-plus text-blueGray-400 mr-2 text-lg"></i>
                    New Violation
                  </Link>
                </li>
                {user.role === 'admin' && (
                  <>
                    <li className="flex items-center">
                      <Link
                        to={adminUsersPath}
                        className={getNavItemClasses(adminUsersPath)}
                      >
                        <i className="fas fa-users text-blueGray-400 mr-2 text-lg"></i>
                        Users
                      </Link>
                    </li>
                    {/* Field Manager Link Removed as functionality is deprecated */}
                    {/* <li className="flex items-center">
                      <Link
                        to="/admin"
                        className="hover:text-blueGray-500 text-blueGray-700 px-3 py-4 lg:py-2 flex items-center text-xs uppercase font-bold"
                      >
                        <i className="fas fa-list text-blueGray-400 mr-2 text-lg"></i>
                        Field Manager
                      </Link>
                    </li> */}
                    <li className="flex items-center">
                      <Link
                        to={adminSettingsPath}
                        className={getNavItemClasses(adminSettingsPath)}
                      >
                        <i className="fas fa-cog text-blueGray-400 mr-2 text-lg"></i>
                        Settings
                      </Link>
                    </li>
                  </>
                )}
              </ul>
              <ul className="flex flex-col lg:flex-row list-none lg:ml-auto">
                <li className="flex items-center">
                  <span className="text-blueGray-700 px-3 py-4 lg:py-2 text-sm">{user.email}</span>
                </li>
                <li className="flex items-center">
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 text-white active:bg-red-600 text-xs font-bold uppercase px-4 py-2 rounded shadow hover:shadow-lg outline-none focus:outline-none lg:mr-1 lg:mb-0 ml-3 mb-3 ease-linear transition-all duration-150"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i> Logout
                  </button>
                </li>
              </ul>
            </div>
          )}
          {!user && (
            <ul className="flex flex-col lg:flex-row list-none lg:ml-auto">
              <li className="flex items-center">
                <Link
                  to="/login"
                  className="bg-lightBlue-500 text-white active:bg-lightBlue-600 text-xs font-bold uppercase px-4 py-2 rounded shadow hover:shadow-lg outline-none focus:outline-none lg:mr-1 lg:mb-0 ml-3 mb-3 ease-linear transition-all duration-150"
                >
                  <i className="fas fa-sign-in-alt mr-2"></i> Login
                </Link>
              </li>
            </ul>
          )}
        </div>
      </nav>
      <div className="relative bg-blueGray-50 pt-16">
        <div className="px-4 md:px-10 mx-auto w-full min-h-screen">
          <div className="relative py-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
} 