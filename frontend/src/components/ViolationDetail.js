import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import Button from './common/Button';
import Input from './common/Input';

export default function ViolationDetail({ usePublicId = false }) {
  const { id, publicId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [violation, setViolation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fields, setFields] = useState([]);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Determine which ID to use and which API endpoint
  const violationIdentifier = usePublicId ? publicId : id;
  const apiEndpoint = usePublicId 
    ? `/api/violations/by-public-id/${publicId}`
    : `/api/violations/${id}`;
  
  const repliesEndpoint = usePublicId
    ? `/api/violations/${violation?.id}/replies` // Need to use numeric ID for replies after we know it
    : `/api/violations/${id}/replies`;

  useEffect(() => {
    // Fetch field definitions to know field types
    API.get('/api/fields')
      .then(res => {
        setFields(res.data);
      })
      .catch(err => {
        console.error('Failed to load field definitions', err);
      });

    API.get(apiEndpoint)
      .then(res => {
        setViolation(res.data);
        setForm({
          ...res.data,
          dynamic_fields: { ...res.data.dynamic_fields }
        });
        setLoading(false);
        
        // After loading the violation, fetch replies if we have the ID
        if (res.data && res.data.id) {
          fetchReplies(res.data.id);
        }
      })
      .catch(err => {
        if (err.response && err.response.status === 403) {
          setError('You do not have permission to view this violation.');
        } else {
          setError('Failed to load violation details.');
        }
        setLoading(false);
      });
  }, [apiEndpoint]);
  
  const fetchReplies = (violationId) => {
    setLoadingReplies(true);
    // Always use the numeric ID for fetching replies
    API.get(`/api/violations/${violationId}/replies`)
      .then(res => {
        setReplies(res.data);
        setLoadingReplies(false);
      })
      .catch(err => {
        console.error('Failed to load replies:', err);
        setLoadingReplies(false);
      });
  };

  const canEditOrDelete = violation && user && (user.role === 'admin' || user.email === violation.created_by || user.id === violation.created_by);

  const handleEdit = () => setEditing(true);
  const handleCancel = () => setEditing(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('dynamic_')) {
      setForm(f => ({ ...f, dynamic_fields: { ...f.dynamic_fields, [name.replace('dynamic_', '')]: value } }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Always use the numeric ID for saving
      await API.put(`/api/violations/${violation.id}`, {
        ...form,
        dynamic_fields: form.dynamic_fields
      });
      setEditing(false);
      // Refresh using the same endpoint we loaded from
      const res = await API.get(apiEndpoint);
      setViolation(res.data);
      setForm({ ...res.data, dynamic_fields: { ...res.data.dynamic_fields } });
    } catch (err) {
      setError('Failed to save changes.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this violation?')) return;
    setDeleting(true);
    try {
      // Always use the numeric ID for deletion
      await API.delete(`/api/violations/${violation.id}`);
      navigate('/violations');
    } catch (err) {
      setError('Failed to delete violation.');
    }
    setDeleting(false);
  };

  // Use public_id paths if available, otherwise fallback to numeric ID
  const handleViewHtml = () => {
    const path = violation.html_path_public_id || violation.html_path;
    if (path) {
      window.open(`${API.defaults.baseURL}${path}`, '_blank');
    }
  };

  const handleDownloadPdf = () => {
    const path = violation.pdf_path_public_id || violation.pdf_path;
    if (path) {
      window.open(`${API.defaults.baseURL}${path}`, '_blank');
    }
  };

  // Function to determine if a field is a file type
  const isFileField = (fieldName) => {
    const fieldDef = fields.find(f => f.name === fieldName);
    return fieldDef?.type === 'file';
  };

  // Function to render an uploaded image gallery
  const renderImageGallery = (fieldName, value) => {
    if (!value) return null;
    
    const imageUrls = value.split(',').filter(Boolean);
    if (imageUrls.length === 0) return null;
    
    return (
      <div className="mt-2">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {imageUrls.map((url, index) => (
            <div key={index} className="relative">
              <a href={`${API.defaults.baseURL}/uploads/${url}`} target="_blank" rel="noopener noreferrer">
                <img 
                  src={`${API.defaults.baseURL}/uploads/${url}`} 
                  alt={`Upload ${index + 1}`} 
                  className="w-full h-auto rounded object-cover aspect-square"
                />
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Format date for display
  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleString();
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!violation) return <div className="p-8">Violation not found.</div>;

  if (editing && form) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Edit Violation</h2>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="mb-4">
            <label className="font-semibold">Reference:</label>
            <span className="ml-2">{form.reference}</span>
          </div>
          
          {/* Display Category and Incident Details prominently for editing */}
          <div className="mt-3 p-3 bg-gray-100 rounded-md">
            <div className="mb-3">
              <label className="font-semibold">Category:</label>
              <Input 
                name="dynamic_Category" 
                value={form.dynamic_fields?.Category || ''} 
                onChange={handleChange} 
                className="border p-1 ml-2 w-full mt-1" 
              />
            </div>
            <div className="mb-2">
              <label className="font-semibold">Details:</label>
              <textarea
                name="dynamic_Incident Details"
                value={form.dynamic_fields?.['Incident Details'] || ''}
                onChange={handleChange}
                className="border p-1 ml-2 w-full mt-1 h-24"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <div className="font-semibold mb-2">Additional Information:</div>
            <ul className="list-disc list-inside">
              {Object.entries(form.dynamic_fields || {}).map(([key, value]) => {
                // Skip Category and Incident Details as they're already displayed above
                if (key === 'Category' || key === 'Incident Details') return null;
                return (
                  <li key={key} className="mb-3">
                    <span className="font-medium">{key}:</span>
                    {isFileField(key) ? (
                      <div>
                        <p className="text-sm text-gray-500 ml-2">File uploads cannot be edited directly.</p>
                        {renderImageGallery(key, value)}
                      </div>
                    ) : (
                      <Input name={`dynamic_${key}`} value={value || ''} onChange={handleChange} className="border p-1 ml-2" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</Button>
            <Button onClick={handleCancel} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Violation Details</h2>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-2"><span className="font-semibold">Reference:</span> {violation.reference}</div>
        <div className="mb-2"><span className="font-semibold">Created At:</span> {violation.created_at ? new Date(violation.created_at).toLocaleString() : ''}</div>
        <div className="mb-2"><span className="font-semibold">Created By:</span> {violation.created_by_email || 'Unknown user'}</div>
        
        {/* Display Category and Incident Details prominently */}
        <div className="mt-3 p-3 bg-gray-100 rounded-md">
          <div className="mb-2">
            <span className="font-semibold">Category:</span> {violation.dynamic_fields?.Category || violation.category || 'Not specified'}
          </div>
          {violation.dynamic_fields?.['Incident Details'] && (
            <div className="mb-2">
              <span className="font-semibold">Details:</span> {violation.dynamic_fields['Incident Details']}
            </div>
          )}
        </div>
        
        <div className="mt-4">
          <div className="font-semibold mb-2">Additional Information:</div>
          <ul className="list-disc list-inside">
            {Object.entries(violation.dynamic_fields || {}).map(([key, value]) => {
              // Skip Category and Incident Details as they're already displayed above
              if (key === 'Category' || key === 'Incident Details') return null;
              return (
                <li key={key} className="mb-3">
                  <span className="font-medium">{key}:</span> 
                  {isFileField(key) ? (
                    renderImageGallery(key, value)
                  ) : (
                    <span>{value}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        
        {/* Display Responses/Replies */}
        {replies.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Responses</h3>
            <div className="space-y-4">
              {replies.map(reply => (
                <div key={reply.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="text-sm text-gray-600 mb-1">
                    <strong>{reply.email}</strong> on {formatDate(reply.created_at)}
                  </div>
                  <div className="whitespace-pre-line">{reply.response_text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {loadingReplies && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-sm text-gray-500">Loading responses...</p>
          </div>
        )}
        
        <div className="mt-6 flex gap-3 flex-wrap">
          <Button onClick={handleViewHtml} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">View as HTML</Button>
          <Button onClick={handleDownloadPdf} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Download PDF</Button>
          
          {canEditOrDelete && (
            <>
              <Button onClick={handleEdit} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">Edit</Button>
              <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Delete</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 