
import React, { useState } from 'react';
import { 
  ClipboardList, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Truck, 
  Plus,
  ArrowUpRight,
  Search,
  X
} from 'lucide-react';
import { AppState, VendorRequest, RequestStatus } from '../types';
import { formatDate, generateId } from '../utils/format';

interface RequestsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: any }> = {
  Pending: { label: 'Pending', color: 'amber', icon: Clock },
  Approved: { label: 'Approved', color: 'indigo', icon: CheckCircle },
  Rejected: { label: 'Rejected', color: 'red', icon: XCircle },
  Delivered: { label: 'Delivered', color: 'emerald', icon: Truck },
};

const Requests: React.FC<RequestsProps> = ({ state, updateState }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleStatusChange = (requestId: string, newStatus: RequestStatus) => {
    updateState(prev => {
      const requests = prev.requests.map(r => 
        r.id === requestId ? { ...r, status: newStatus } : r
      );

      // If delivered, we might want to auto-increment stock if it was a raw material inbound?
      // For simplicity here, we'll just track the request status.
      
      return { ...prev, requests };
    });
  };

  const handleCreateRequest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const vendor = state.vendors.find(v => v.id === data.vendorId);
    const product = state.products.find(p => p.id === data.productId);

    if (!vendor || !product) return;

    const newRequest: VendorRequest = {
      id: generateId('REQ'),
      vendorId: vendor.id,
      vendorName: vendor.name,
      productId: product.id,
      productName: product.name,
      quantity: Number(data.quantity),
      expectedDate: data.expectedDate as string,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    updateState(prev => ({
      ...prev,
      requests: [newRequest, ...prev.requests]
    }));
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Supply & Production Requests</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-semibold transition-all"
        >
          <Plus size={20} />
          <span>New Request</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Request ID</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Item & Qty</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Exp. Delivery</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.requests.length > 0 ? state.requests.map(req => {
                const config = STATUS_CONFIG[req.status];
                const Icon = config.icon;

                return (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-indigo-600 font-mono">{req.id}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{req.vendorName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{req.productName}</p>
                      <p className="text-xs text-gray-500">{req.quantity} units</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-${config.color}-100 text-${config.color}-700 border border-${config.color}-200 shadow-sm`}>
                        <Icon size={12} className="mr-1.5" />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDate(req.expectedDate)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {req.status === 'Pending' && (
                          <>
                            <button 
                              onClick={() => handleStatusChange(req.id, 'Approved')}
                              className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-bold hover:bg-indigo-100 transition-colors"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleStatusChange(req.id, 'Rejected')}
                              className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {req.status === 'Approved' && (
                          <button 
                            onClick={() => handleStatusChange(req.id, 'Delivered')}
                            className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold hover:bg-emerald-100 transition-colors"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                    <ClipboardList size={48} className="mx-auto mb-4 opacity-10" />
                    <p>No requests found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">New Supply Request</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form className="p-6" onSubmit={handleCreateRequest}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Vendor *</label>
                  <select required name="vendorId" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Vendor</option>
                    {state.vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Product *</label>
                  <select required name="productId" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Product</option>
                    {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Quantity *</label>
                    <input required type="number" min="1" name="quantity" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Exp. Delivery *</label>
                    <input required type="date" name="expectedDate" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end space-x-3 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-600 font-semibold">Cancel</button>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-bold">
                  Create Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Requests;
