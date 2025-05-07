import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './views/auth/Login';
import Dashboard from './views/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrivateRoute, AdminRoute } from './components/Routes';
import ViolationList from './components/ViolationList';
import ViolationDetail from './components/ViolationDetail';
import UserManagement from './components/UserManagement';
import Settings from './components/Settings';
import Layout from './components/common/Layout';
import LoadingOverlay from './components/common/LoadingOverlay';
import API from './api';
import StaticViolationForm from './components/StaticViolationForm';
import UnitListPage from './views/UnitListPage';
import UnitProfileDetailPage from './views/UnitProfileDetailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ObfuscatedRouter from './components/ObfuscatedRouter';
import UnitCreatePage from './views/UnitCreatePage';
import {
  DASHBOARD_PATH,
  VIOLATIONS_PATH,
  VIOLATIONS_NEW_PATH,
  UNITS_PATH,
  ADMIN_USERS_PATH,
  ADMIN_SETTINGS_PATH,
  LOGIN_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH
} from './utils/routeMapper'; // Import the constants

function NewViolationPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('Submitting...'); // For more detailed feedback
  
  const handleSubmit = async (values) => {
    setIsSubmitting(true);
    setSubmitMessage('Creating violation record...');
    
    // 1. Separate files from other data
    const { attach_evidence, ...violationData } = values;
    const filesToUpload = attach_evidence || [];
    
    let violationId = null;

    try {
      // 2. Create the violation record (without files)
      const createResponse = await API.post('/api/violations', violationData);
      
      if (!createResponse.data || !createResponse.data.id) {
        throw new Error('Failed to create violation record. No ID received.');
      }
      violationId = createResponse.data.id;
      console.log('Violation created with ID:', violationId);

      // 3. Upload files if they exist
      if (filesToUpload.length > 0) {
        setSubmitMessage(`Uploading ${filesToUpload.length} evidence file(s)...`);
        const formData = new FormData();
        filesToUpload.forEach((file) => {
          // The backend expects files under the key 'files'
          formData.append('files', file);
        });

        // Use the field name 'attach_evidence' as a query parameter
        // if your backend endpoint /api/violations/<id>/upload requires it.
        // Check the api_upload_files route in violation_routes.py
        // It currently expects `request.args.get('field')`, but we might not need it
        // if we only have one file field. Let's omit it for now unless errors occur.
        try {
          const uploadResponse = await API.post(`/api/violations/${violationId}/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          console.log('File upload response:', uploadResponse.data);
          if (uploadResponse.data.warnings && uploadResponse.data.warnings.length > 0) {
             // Optionally alert user about non-critical upload warnings
             console.warn("File upload warnings:", uploadResponse.data.warnings);
          }
        } catch (uploadError) {
            console.error('File upload failed:', uploadError.response ? uploadError.response.data : uploadError);
             // Decide how to handle upload failure: proceed with navigation? Show blocking error?
            // For now, log the error and proceed, but alert the user.
            alert(`Violation created (ID: ${violationId}), but evidence upload failed. Please try uploading files later via the edit page.\nError: ${uploadError.response?.data?.error || uploadError.message}`);
             // Skip navigation or navigate anyway?
             // Let's navigate but the user knows files failed.
        }
      }

      // 4. Success - Navigate to the new violation detail page
      setSubmitMessage('Success!');
      setIsSubmitting(false);
      navigate(`/violations/${violationId}`);

    } catch (error) {
      // Handle errors from either creation or upload step
      setIsSubmitting(false);
      setSubmitMessage('Submission failed.'); // Reset message
      console.error('Error during violation submission process:', error.response ? error.response.data : error);
      alert('Failed to submit violation: ' + (error.response?.data?.error || error.message || 'Unknown error'));
       // Do not navigate on error
    }
  };
  
  // Remove handleFileUploadsComplete as it's no longer needed with this flow
  // const handleFileUploadsComplete = () => { ... };
  
  return (
    <Layout>
      <LoadingOverlay 
        isLoading={isSubmitting} 
        message={submitMessage} // Use the dynamic message
      />
      <StaticViolationForm 
        onSubmit={handleSubmit} 
        submitLabel="Create Violation" 
      />
    </Layout>
  );
}

// Helper component to protect routes
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  let location = useLocation();

  if (isLoading) {
    // Optional: Render a loading indicator while auth state is resolving
    return <div>Loading authentication...</div>;
  }

  if (!user) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  // Get the obfuscated paths directly from routeMapper.js values
  // const dashboardPath = '/r/d5f8a61b2e4c'; // Replaced by import
  // const violationsPath = '/r/7a9c3b5d2f1e'; // Replaced by import
  // const violationsNewPath = '/r/e8f2c1d5a6b3'; // Replaced by import
  // const unitsPath = '/r/b4d6e8f2a1c3'; // Replaced by import
  // const adminUsersPath = '/r/c3a5b7d9e1f2'; // Replaced by import
  // const adminSettingsPath = '/r/a1b3c5d7e9f2'; // Replaced by import

  return (
    <Router>
      <AuthProvider>
        <ObfuscatedRouter>
          <Routes>
            {/* Public Routes - Keep these clear for usability */}
            <Route path={LOGIN_PATH} element={<Login />} />
            <Route path={FORGOT_PASSWORD_PATH} element={<ForgotPasswordPage />} />
            <Route path={`${RESET_PASSWORD_PATH}/:token`} element={<ResetPasswordPage />} />
            <Route path="/violations/public/:public_id" element={<ViolationDetail usePublicId={true} />} />

            {/* Protected Routes - Use obfuscated paths directly */}
            <Route path="/" element={<ProtectedRoute><Layout><Navigate to={DASHBOARD_PATH} replace /></Layout></ProtectedRoute>} />
            <Route path={DASHBOARD_PATH} element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            
            {/* Unit Profile Routes */}
            <Route path={UNITS_PATH} element={ // Use imported constant
              <ProtectedRoute>
                <Layout>
                  <UnitListPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path={`${UNITS_PATH}/new`} element={ // Use imported constant
              <ProtectedRoute>
                <Layout>
                  <UnitCreatePage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path={`${UNITS_PATH}/:unitNumber`} element={ // Use imported constant
              <ProtectedRoute>
                <Layout>
                  <UnitProfileDetailPage />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path={ADMIN_USERS_PATH} element={<AdminRoute><Layout><UserManagement /></Layout></AdminRoute>} />
            <Route path={ADMIN_SETTINGS_PATH} element={<AdminRoute><Layout><Settings /></Layout></AdminRoute>} /> 
            
            {/* Violation Routes */}
            <Route path={VIOLATIONS_NEW_PATH} element={ // Use imported constant
              <ProtectedRoute>
                <NewViolationPage />
              </ProtectedRoute>
            } />
            <Route path={VIOLATIONS_PATH} element={ // Use imported constant
              <ProtectedRoute>
                <Layout>
                  <ViolationList />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path={`${VIOLATIONS_PATH}/:id`} element={ // Use imported constant
              <ProtectedRoute>
                <Layout>
                  <ViolationDetail usePublicId={false} />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path={`${VIOLATIONS_PATH}/public/:publicId`} element={ // Use imported constant
              <ProtectedRoute>
                <Layout>
                  <ViolationDetail usePublicId={true} />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* No longer need to handle /r/* separately since we're using the obfuscated paths directly */}
            
            {/* Dashboard route again for direct access */}
            <Route path="/dashboard" element={<ProtectedRoute><Layout><Navigate to={DASHBOARD_PATH} replace /></Layout></ProtectedRoute>} />
            
            {/* Fallback Route */}
            <Route path="*" element={<ProtectedRoute><div>404 Not Found</div></ProtectedRoute>} />
            
          </Routes>
        </ObfuscatedRouter>
      </AuthProvider>
    </Router>
  );
}

export default App;
