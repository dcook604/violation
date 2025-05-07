// No need for crypto dependencies now
import sha256 from 'js-sha256';

// Fixed dictionary of obfuscated routes
const routeMap = {
  '/dashboard': '/r/d5f8a61b2e4c',
  '/violations': '/r/7a9c3b5d2f1e',
  '/violations/new': '/r/e8f2c1d5a6b3',
  '/units': '/r/b4d6e8f2a1c3',
  '/admin/users': '/r/c3a5b7d9e1f2',
  '/admin/settings': '/r/a1b3c5d7e9f2',
  '/login': '/login', // Keep authentication routes clear for usability
  '/forgot-password': '/forgot-password',
  '/reset-password': '/reset-password'
};

// Exporting constants for use in other modules
export const DASHBOARD_PATH = routeMap['/dashboard'];
export const VIOLATIONS_PATH = routeMap['/violations'];
export const VIOLATIONS_NEW_PATH = routeMap['/violations/new'];
export const UNITS_PATH = routeMap['/units'];
export const ADMIN_USERS_PATH = routeMap['/admin/users'];
export const ADMIN_SETTINGS_PATH = routeMap['/admin/settings'];
export const LOGIN_PATH = routeMap['/login'];
export const FORGOT_PASSWORD_PATH = routeMap['/forgot-password'];
export const RESET_PASSWORD_PATH = routeMap['/reset-password'];

// Reverse map for lookups
const reverseRouteMap = Object.entries(routeMap).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {});

// Generate a deterministic hash for a route
// This is only used for debugging or adding new routes
function generateHash(route) {
  // Use js-sha256 directly
  const secretKey = process.env.REACT_APP_ROUTE_SECRET || 'route-secret-key';
  const hash = sha256(route + secretKey).substring(0, 12);
  return `/r/${hash}`;
}

// Convert a real route to its obfuscated version
export function obfuscateRoute(route) {
  // Handle dynamic routes
  if (route.includes('/:')) {
    const parts = route.split('/');
    const basePath = parts.filter(part => !part.startsWith(':')).join('/');
    
    if (routeMap[basePath]) {
      // Replace the base path with its obfuscated version
      return route.replace(basePath, routeMap[basePath]);
    }
  }
  
  return routeMap[route] || route;
}

// Convert an obfuscated route back to a real route
export function deobfuscateRoute(route) {
  // Handle routes with parameters
  if (route.startsWith('/r/')) {
    const hashPart = route.split('/').slice(0, 3).join('/');
    const params = route.split('/').slice(3).join('/');
    
    const realBasePath = reverseRouteMap[hashPart];
    if (realBasePath && params) {
      return `${realBasePath}/${params}`;
    }
    return reverseRouteMap[route] || route;
  }
  
  return reverseRouteMap[route] || route;
}

// Get all route mappings for debugging
export function getAllRouteMappings() {
  return { ...routeMap };
} 