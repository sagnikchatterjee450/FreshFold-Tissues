
import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, User, Phone, MapPin, Building, X } from 'lucide-react';
import { AppState, Vendor } from '../types';
import { generateId } from '../utils/format';

interface VendorsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Vendors: React.FC<VendorsProps> = ({ state, updateState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const filteredVendors = state.vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.gstin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: string) => {
    if (confirm('Delete this vendor record? This will not affect past orders.')) {
      updateState(prev => ({
        ...prev,
        vendors: prev.vendors.filter(v => v.id !== id)
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search vendors by name or GSTIN..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setEditingVendor(null);
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-all font-semibold"
        >
          <Plus size={20} />
          <span>New Vendor</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.length > 0 ? filteredVendors.map(vendor => (
          <div key={vendor.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative group hover:shadow-md transition-shadow">
            <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  setEditingVendor(vendor);
                  setIsModalOpen(true);
                }}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => handleDelete(vendor.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 flex-shrink-0">
                <Building size={24} />
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="font-bold text-gray-900 truncate pr-8">{vendor.name}</h3>
                <p className="text-xs font-mono text-indigo-600 font-bold mb-4">{vendor.gstin}</p>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Phone size={14} className="text-gray-400" />
                    <span>{vendor.contact}</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <MapPin size={14} className="text-gray-400 mt-1 flex-shrink-0" />
                    <span className="line-clamp-2">{vendor.address}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center text-gray-400">
            <User size={64} className="mx-auto mb-4 opacity-10" />
            <p>No vendors found.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingVendor ? 'Edit Vendor Details' : 'Register New Vendor'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form className="p-6" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              const vendor: Vendor = {
                id: editingVendor?.id || generateId('VND'),
                name: data.name as string,
                gstin: data.gstin as string,
                contact: data.contact as string,
                address: data.address as string,
              };

              updateState(prev => {
                const vendors = [...prev.vendors];
                if (editingVendor) {
                  const idx = vendors.findIndex(v => v.id === editingVendor.id);
                  vendors[idx] = vendor;
                } else {
                  vendors.push(vendor);
                }
                return { ...prev, vendors };
              });
              setIsModalOpen(false);
            }}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Company Name *</label>
                  <input required name="name" defaultValue={editingVendor?.name} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g. ABC Packaging Solutions" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">GSTIN *</label>
                  <input required name="gstin" defaultValue={editingVendor?.gstin} className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono uppercase" placeholder="22AAAAA0000A1Z5" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Contact Number *</label>
                  <input required name="contact" defaultValue={editingVendor?.contact} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Address *</label>
                  <textarea required name="address" defaultValue={editingVendor?.address} className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24 resize-none" placeholder="Full business address..." />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end space-x-3 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-600 font-semibold">Cancel</button>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-bold">
                  {editingVendor ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
