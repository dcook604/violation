import React, { useEffect, useState } from 'react';
import API from '../api';
import Button from './common/Button';
import Input from './common/Input';

function DynamicViolationForm({ onSubmit, initialValues = {}, submitLabel = 'Submit' }) {
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [fileUploads, setFileUploads] = useState({});

  useEffect(() => {
    const fetchFields = async () => {
      setLoading(true);
      try {
        // Use the optimized endpoint for active fields only
        const res = await API.get('/api/fields/active');
        setFields(res.data);
        
        // Set up initial form values with default standard fields
        const newVals = { 
          ...initialValues,
          category: initialValues.category || '',
          building: initialValues.building || '',
          unit_number: initialValues.unit_number || '',
          incident_date: initialValues.incident_date || '',
          subject: initialValues.subject || '',
          details: initialValues.details || ''
        };
        
        // Add dynamic fields if they're not already present
        res.data.forEach(f => {
          if (!(f.name in newVals)) newVals[f.name] = '';
        });
        
        setValues(newVals);
      } catch (err) {
        console.error('Error fetching fields:', err);
        setErrors({ global: 'Failed to load fields' });
      }
      setLoading(false);
    };
    fetchFields();
  }, []);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFileChange = (fieldName, e) => {
    const files = Array.from(e.target.files);
    
    // Get field definition
    const fieldDef = fields.find(f => f.name === fieldName);
    if (!fieldDef) return;
    
    // Parse validation rules
    let validationRules = { maxFiles: 5, maxSizePerFile: 5 };
    try {
      if (fieldDef.validation) {
        validationRules = JSON.parse(fieldDef.validation);
      }
    } catch (err) {
      console.error('Invalid validation JSON', err);
    }
    
    // Validate file count
    if (files.length > validationRules.maxFiles) {
      setErrors(prev => ({ 
        ...prev, 
        [fieldName]: `Maximum of ${validationRules.maxFiles} files allowed`
      }));
      return;
    }
    
    // Validate file sizes
    const maxSizeBytes = validationRules.maxSizePerFile * 1024 * 1024; // convert MB to bytes
    const oversizedFiles = files.filter(file => file.size > maxSizeBytes);
    if (oversizedFiles.length > 0) {
      setErrors(prev => ({ 
        ...prev, 
        [fieldName]: `Files must be smaller than ${validationRules.maxSizePerFile}MB`
      }));
      return;
    }
    
    // Store files for later submission
    setFileUploads(prev => ({
      ...prev,
      [fieldName]: files
    }));
    
    // Clear errors if validation passes
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const errs = {};
    fields.forEach(f => {
      if (f.required && !values[f.name] && f.type !== 'file') {
        errs[f.name] = `${f.label} is required.`;
      }
      
      // Validate required file uploads
      if (f.type === 'file' && f.required && (!fileUploads[f.name] || fileUploads[f.name].length === 0)) {
        errs[f.name] = `${f.label} is required.`;
      }
      
      // Validate email format
      if (f.type === 'email' && values[f.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.name])) {
        errs[f.name] = `Please enter a valid email address.`;
      }

      // Add more type/validation logic as needed
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    
    try {
      // Organize form data - separating standard fields from dynamic fields
      const standardFields = {
        category: values.category || '',
        building: values.building || '',
        unit_number: values.unit_number || '',
        incident_date: values.incident_date || '',
        subject: values.subject || '',
        details: values.details || ''
      };
      
      // Extract dynamic fields (any fields not in the standard set)
      const dynamic_fields = {};
      Object.keys(values).forEach(key => {
        if (!['category', 'building', 'unit_number', 'incident_date', 'subject', 'details'].includes(key)) {
          dynamic_fields[key] = values[key];
        }
      });
      
      // Combine them for the API request
      const formData = {
        ...standardFields,
        dynamic_fields
      };
      
      console.log('Submitting violation data:', formData);
      const response = await onSubmit(formData);
      
      // If we have file uploads and the form submission returned a violation ID, upload the files
      const violationId = response?.id;
      if (violationId && Object.keys(fileUploads).length > 0) {
        await uploadFiles(violationId);
      }
    } catch (err) {
      setErrors({ global: 'Form submission failed' });
    }
  };
  
  const uploadFiles = async (violationId) => {
    console.log(`Starting uploads for violation ${violationId}. Fields to upload:`, Object.keys(fileUploads));
    
    for (const [fieldName, files] of Object.entries(fileUploads)) {
      if (!files || files.length === 0) {
        console.log(`No files to upload for field ${fieldName}`);
        continue;
      }
      
      console.log(`Uploading ${files.length} file(s) for field ${fieldName}:`, 
        files.map(f => `${f.name} (${Math.round(f.size/1024)} KB)`));
      
      const formData = new FormData();
      
      // Append each file individually to the FormData
      files.forEach((file, index) => {
        formData.append('files', file, file.name);
        console.log(`Added file ${index+1}/${files.length} to FormData: ${file.name}`);
      });
      
      // Log keys in FormData for debugging
      console.log(`FormData keys: ${[...formData.keys()].join(', ')}`);
      
      try {
        console.log(`Sending upload request to /api/violations/${violationId}/upload?field=${fieldName}`);
        const response = await API.post(`/api/violations/${violationId}/upload?field=${fieldName}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        console.log(`Upload successful for ${fieldName}:`, response.data);
      } catch (err) {
        console.error(`Failed to upload files for ${fieldName}:`, err);
        if (err.response) {
          console.error(`Server responded with status ${err.response.status}:`, 
            err.response.data || 'No response data');
        }
        setErrors(prev => ({ 
          ...prev,
          [fieldName]: `Failed to upload files: ${err.message || 'Unknown error'}` 
        }));
      }
    }
  };

  if (loading) return <div>Loading fields...</div>;

  // Group fields by their grid layout properties
  const renderFields = () => {
    // Sort fields by order first
    const orderedFields = [...fields].sort((a, b) => a.order - b.order);
    
    // Track the current row of fields
    let currentRow = [];
    let currentRowWidth = 0;
    const rows = [];
    
    // Process each field
    orderedFields.forEach(field => {
      // Get the column width (0 = full width/12 columns)
      const colWidth = field.grid_column || 0;
      const colSpan = colWidth === 0 ? 12 : colWidth;
      
      // If this field is full width or would overflow the row, start a new row
      if (colSpan === 12 || currentRowWidth + colSpan > 12) {
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
          currentRow = [];
          currentRowWidth = 0;
        }
      }
      
      // Add field to current row
      currentRow.push(field);
      currentRowWidth += colSpan;
      
      // If we've filled the row, add it to rows and reset
      if (currentRowWidth === 12) {
        rows.push([...currentRow]);
        currentRow = [];
        currentRowWidth = 0;
      }
    });
    
    // Add any remaining fields in the last row
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    
    // Render rows and fields
    return rows.map((row, rowIdx) => (
      <div key={`row-${rowIdx}`} className="flex flex-wrap mb-2 -mx-2">
        {row.map(field => {
          const colWidth = field.grid_column || 0;
          const colSpan = colWidth === 0 ? 12 : colWidth;
          
          // Calculate Tailwind width classes
          const widthClass = 
            colSpan === 12 ? 'w-full' :
            colSpan === 6 ? 'w-1/2' :
            colSpan === 4 ? 'w-1/3' :
            colSpan === 3 ? 'w-1/4' :
            'w-full';
          
          return (
            <div key={field.id} className={`${widthClass} px-2 mb-3`}>
              <label className="block font-semibold mb-1">{field.label}{field.required && ' *'}</label>
              
              {field.type === 'text' && (
                <Input name={field.name} value={values[field.name] || ''} onChange={handleChange} />
              )}
              
              {field.type === 'email' && (
                <Input type="email" name={field.name} value={values[field.name] || ''} onChange={handleChange} />
              )}
              
              {field.type === 'number' && (
                <Input type="number" name={field.name} value={values[field.name] || ''} onChange={handleChange} />
              )}
              
              {field.type === 'date' && (
                <Input type="date" name={field.name} value={values[field.name] || ''} onChange={handleChange} />
              )}
              
              {field.type === 'time' && (
                <Input type="time" name={field.name} value={values[field.name] || ''} onChange={handleChange} />
              )}
              
              {field.type === 'select' && (
                <select className="border p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500" name={field.name} value={values[field.name] || ''} onChange={handleChange}>
                  <option value="">Select...</option>
                  {(field.options ? field.options.split(',') : []).map(opt => (
                    <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                  ))}
                </select>
              )}
              
              {field.type === 'file' && (
                <div>
                  <input 
                    type="file" 
                    className="w-full border p-2 rounded" 
                    onChange={(e) => handleFileChange(field.name, e)} 
                    multiple
                    accept="image/jpeg,image/png,image/gif"
                  />
                  {field.validation && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(() => {
                        try {
                          const validation = JSON.parse(field.validation);
                          return `Max ${validation.maxFiles} files, ${validation.maxSizePerFile}MB per file`;
                        } catch (e) {
                          return 'Max 5 files, 5MB per file';
                        }
                      })()}
                    </p>
                  )}
                  {fileUploads[field.name] && fileUploads[field.name].length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm">{fileUploads[field.name].length} file(s) selected</p>
                      <ul className="text-xs text-gray-500">
                        {fileUploads[field.name].map((file, idx) => (
                          <li key={idx}>{file.name} ({Math.round(file.size / 1024)} KB)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {errors[field.name] && <div className="text-red-600 text-sm mt-1">{errors[field.name]}</div>}
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <form onSubmit={handleSubmit}>
      {renderFields()}
      {errors.global && <div className="text-red-600 text-sm mb-2">{errors.global}</div>}
      <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">{submitLabel}</Button>
    </form>
  );
}

export default DynamicViolationForm; 