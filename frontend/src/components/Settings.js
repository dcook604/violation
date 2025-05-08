import React, { useState, useEffect } from 'react';
import API from '../api';
import Button from './common/Button';
import Input from './common/Input';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    smtp_server: '',
    smtp_port: 25,
    smtp_username: '',
    smtp_password: '',
    smtp_use_tls: true,
    smtp_from_email: '',
    smtp_from_name: '',
    notification_emails: '',
    enable_global_notifications: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    // Only admins can access settings
    if (!user || !user.is_admin) {
      setError('Admin privileges required to access settings');
      setLoading(false);
      return;
    }

    // Load settings from API
    API.get('/api/admin/settings')
      .then(res => {
        setSettings(res.data);
        setTestEmailAddress(user.email || '');
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load settings: ' + (err.response?.data?.error || err.message || 'Unknown error'));
        setLoading(false);
      });
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Special handling for checkbox inputs
    if (type === 'checkbox') {
      console.log(`Checkbox ${name} changed to: ${checked}`);
      setSettings(prev => ({ ...prev, [name]: checked }));
      return;
    }
    
    // For smtp_port, convert to number
    if (name === 'smtp_port') {
      setSettings(prev => ({ ...prev, [name]: parseInt(value, 10) || '' }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await API.put('/api/admin/settings', settings);
      setSuccess('Settings saved successfully!');
      
      // If there's a new timestamp from the server, update it
      if (response.data.updated_at) {
        setSettings(prev => ({ ...prev, updated_at: response.data.updated_at }));
      }
    } catch (err) {
      setError('Failed to save settings: ' + (err.response?.data?.error || err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      setTestResult({ success: false, message: 'Please enter an email address' });
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      const response = await API.post('/api/admin/settings/test-email', { email: testEmailAddress });
      setTestResult({ success: true, message: response.data.message });
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: 'Failed to send test email: ' + (err.response?.data?.error || err.message || 'Unknown error') 
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error && !settings.id) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">System Settings</h2>
      
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Email Configuration</h3>
          <p className="text-gray-600 mb-4">
            The system's email sending configuration is managed via environment variables.
            Use the test function below to verify the current setup.
          </p>
          
          <div className="bg-gray-50 p-4 rounded mt-4">
            <h4 className="font-semibold mb-2">Test Email Configuration</h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="Enter email address"
                className="flex-grow"
              />
              <Button
                onClick={handleTestEmail}
                disabled={sendingTest}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {sendingTest ? 'Sending...' : 'Send Test Email'}
              </Button>
            </div>
            {testResult && (
              <div className={`mt-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Global Notifications</h3>
          <p className="text-gray-600 mb-4">
            Configure email addresses to receive system-wide notifications.
          </p>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notification Emails (comma-separated)
            </label>
            <textarea
              name="notification_emails"
              value={settings.notification_emails}
              onChange={handleChange}
              rows="3"
              placeholder="e.g. admin@example.com, manager@example.com"
              className="w-full p-2 border border-gray-300 rounded shadow-sm"
            />
          </div>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="enable_global_notifications"
                checked={settings.enable_global_notifications}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">Enable Global Notifications</span>
            </label>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
} 