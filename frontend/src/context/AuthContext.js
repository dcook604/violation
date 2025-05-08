import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import API from '../api';

const AuthContext = createContext();

// Constants for idle timeout
const IDLE_TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const WARNING_DURATION_BEFORE_TIMEOUT = 2 * 60 * 1000; // Show warning 2 minutes before timeout

// Simple Modal Component (can be styled further or moved to a separate file)
const IdleWarningModal = ({ onStayLoggedIn, onLogout }) => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
    alignItems: 'center', justifyContent: 'center', zIndex: 1000
  }}>
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.25rem' }}>Session Timeout Warning</h3>
      <p style={{ marginBottom: '20px', fontSize: '1rem' }}>Your session is about to expire due to inactivity. You will be logged out in approximately 2 minutes.</p>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <button 
          onClick={onStayLoggedIn}
          style={{ padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Stay Logged In
        </button>
        <button 
          onClick={onLogout}
          style={{ padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Logout Now
        </button>
      </div>
    </div>
  </div>
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [showIdleWarningModal, setShowIdleWarningModal] = useState(false);
  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);

  const checkSession = useCallback(async () => {
    try {
      console.log("Checking session...");
      const response = await API.get('/api/auth/status-jwt');
      console.log("Session response:", response.data);
      
      if (response.data.user) {
        setUser(response.data.user);
        if (window.location.pathname === '/login') {
          navigate('/dashboard');
        }
      } else {
        console.log("No user in session response");
        setUser(null);
      }
    } catch (error) {
      console.log('Session check failed:', error);
      setUser(null);
      if (window.location.pathname !== '/login') {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // Failsafe: set loading to false after 5 seconds no matter what
    const timeout = setTimeout(() => setLoading(false), 5000);
    checkSession();
    return () => clearTimeout(timeout);
  }, [checkSession]);

  const login = async (credentials) => {
    try {
      setError(null);
      console.log("Attempting login with:", credentials.email);
      
      // Use JWT login endpoint which has CSRF exemption
      const response = await API.post('/api/auth/login-jwt', credentials);
      console.log("Login response:", response.data);
      
      // JWT login returns user differently
      if (response.data.user) {
        setUser(response.data.user);
        navigate('/dashboard');
        return response.data;
      } else if (response.data.login === true && response.data.user) {
        setUser(response.data.user);
        navigate('/dashboard');
        return response.data;
      } else {
        throw new Error("Login response missing user data");
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Login failed';
      setError(errorMessage);
      throw error;
    }
  };

  const logout = useCallback(async () => {
    try {
      console.log("Logging out...");
      await API.post('/api/auth/logout-jwt');
      setUser(null);
      localStorage.removeItem('rememberedEmail');
      // Clear timers on explicit logout
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setShowIdleWarningModal(false);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [navigate]);

  // --- Idle Timeout Logic ---
  const logoutDueToInactivity = useCallback(() => {
    console.log("Logging out due to inactivity.");
    setShowIdleWarningModal(false);
    logout(); // Call the memoized logout function
  }, [logout]);

  const showWarningModal = useCallback(() => {
    console.log("Showing idle warning modal.");
    setShowIdleWarningModal(true);
  }, []);

  const resetIdleTimers = useCallback(() => {
    setShowIdleWarningModal(false);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (user) { // Only set timers if a user is logged in
      warningTimerRef.current = setTimeout(
        showWarningModal,
        IDLE_TIMEOUT_DURATION - WARNING_DURATION_BEFORE_TIMEOUT
      );
      idleTimerRef.current = setTimeout(
        logoutDueToInactivity,
        IDLE_TIMEOUT_DURATION
      );
    }
  }, [user, logoutDueToInactivity, showWarningModal]); // Removed duration constants as they don't change

  useEffect(() => {
    if (!user) {
      // No user, clear any existing timers and ensure modal is hidden
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setShowIdleWarningModal(false);
      // Event listeners are managed below and will be removed if they were added
      return;
    }

    // User is logged in, set up activity listeners and initial timers
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      resetIdleTimers();
    };

    activityEvents.forEach(event => window.addEventListener(event, handleActivity, { capture: true, passive: true }));
    resetIdleTimers(); // Initial setup of timers when user logs in or becomes active

    return () => {
      // Cleanup: remove event listeners and clear timers
      activityEvents.forEach(event => window.removeEventListener(event, handleActivity, { capture: true, passive: true }));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, resetIdleTimers]);

  const handleStayLoggedIn = () => {
    console.log("User chose to stay logged in.");
    resetIdleTimers(); // This will hide the modal and reset both timers
  };
  // --- End Idle Timeout Logic ---

  if (loading) {
    console.log("AuthProvider loading:", loading, "user:", user);
    return <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
    </div>;
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      loading, 
      error,
      checkSession,
      isAuthenticated: !!user 
    }}>
      {children}
      {showIdleWarningModal && user && (
        <IdleWarningModal 
          onStayLoggedIn={handleStayLoggedIn}
          onLogout={logout} // Use the main logout function
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 