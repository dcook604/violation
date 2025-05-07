import React from 'react';
import Input from './common/Input';
import Button from './common/Button';

export default function ViolationEditForm({ form, setForm, saving, handleSave, handleCancel, errors }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('dynamic_')) {
      setForm(f => ({ ...f, dynamic_fields: { ...f.dynamic_fields, [name.replace('dynamic_', '')]: value } }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  return (
    <div className="w-full mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Edit Violation</h2>
      <div className="bg-white rounded-lg">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6">
          <div>
            <label className="block text-gray-600 font-medium mb-2">Reference:</label>
            <Input 
              name="reference" 
              value={form.reference || ''} 
              onChange={handleChange} 
              className="bg-gray-100"
              disabled={true}
            />
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-2">Status:</label>
            <select
              name="status"
              value={form.status || ''}
              onChange={handleChange}
              className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-2">Unit Number:</label>
            <Input 
              name="unit_number" 
              value={form.unit_number || ''} 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-2">Building:</label>
            <Input 
              name="building" 
              value={form.building || ''} 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-2">Category:</label>
            <Input 
              name="dynamic_Category" 
              value={form.dynamic_fields?.Category || ''} 
              onChange={handleChange} 
            />
          </div>
        </div>

        {/* Violation Details Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Violation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <label className="block text-gray-600 font-medium mb-2">Location:</label>
              <Input 
                name="dynamic_Location" 
                value={form.dynamic_fields?.Location || ''} 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-2">Security/Police Called:</label>
              <Input 
                name="dynamic_Security/Police Called" 
                value={form.dynamic_fields?.['Security/Police Called'] || ''} 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-2">Fine Levied:</label>
              <Input 
                name="dynamic_Fine Levied" 
                value={form.dynamic_fields?.['Fine Levied'] || ''} 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-2">Noticed By:</label>
              <Input 
                name="dynamic_Noticed By" 
                value={form.dynamic_fields?.['Noticed By'] || ''} 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-2">Concierge Shift:</label>
              <Input 
                name="concierge_shift" 
                value={form.concierge_shift || ''} 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-2">People Called:</label>
              <Input 
                name="dynamic_People Called" 
                value={form.dynamic_fields?.['People Called'] || ''} 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label className="block text-gray-600 font-medium mb-2">Actioned By:</label>
              <Input 
                name="dynamic_Actioned By" 
                value={form.dynamic_fields?.['Actioned By'] || ''} 
                onChange={handleChange} 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-600 font-medium mb-2">People Involved:</label>
              <Input 
                name="dynamic_People Involved" 
                value={form.dynamic_fields?.['People Involved'] || ''} 
                onChange={handleChange} 
              />
            </div>
          </div>
        </div>

        {/* Incident Details & Action Taken */}
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Incident Details</h3>
          <div>
            <textarea
              name="dynamic_Incident Details"
              value={form.dynamic_fields?.['Incident Details'] || ''}
              onChange={handleChange}
              className="w-full border rounded p-2 min-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter incident details..."
            />
          </div>
        </div>
        
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Action Taken</h3>
          <div>
            <textarea
              name="dynamic_Action Taken"
              value={form.dynamic_fields?.['Action Taken'] || ''}
              onChange={handleChange}
              className="w-full border rounded p-2 min-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter actions taken..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
          <Button 
            onClick={handleSave} 
            color="lightBlue"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button 
            onClick={handleCancel} 
            color="blueGray"
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
} 