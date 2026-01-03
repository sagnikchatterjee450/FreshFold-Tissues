
import React, { useMemo } from 'react';
// Added missing Link import from react-router-dom
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import { AppState } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC<{ state: AppState }> = ({ state }) => {
  const kpis = useMemo(() => {
    const totalInventoryValue = state.products.reduce((acc, p) => acc + (p.stockQuantity * p.costPrice), 0);
    const lowStockCount = state.products.filter(p => p.stockQuantity <= p.minThreshold && p.stockQuantity > 0).length;
    const outOfStockCount = state.products.filter(p => p.stockQuantity === 0).length;
    const pendingRequests = state.requests.filter(r => r.status === 'Pending').length;

    return [
      { label: 'Total Products', value: state.products.length, icon: Package, color: 'indigo' },
      { label: 'Inventory Value', value: formatCurrency(totalInventoryValue), icon: TrendingUp, color: 'emerald' },
      { label: 'Low Stock Items', value: lowStockCount, icon: AlertTriangle, color: 'amber' },
      { label: 'Pending Requests', value: pendingRequests, icon: Clock, color: 'blue' },
    ];
  }, [state]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    state.products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [state]);

  const orderTrendData = useMemo(() => {
    // Last 7 days aggregation for demo
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayOrders = state.orders.filter(o => o.date.startsWith(date));
      const total = dayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      return {
        name: formatDate(date),
        revenue: total
      };
    });
  }, [state]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className={`p-3 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-600`}>
              <kpi.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{kpi.label}</p>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800">Revenue Trend (Last 7 Days)</h3>
            <span className="text-sm text-indigo-600 font-medium cursor-pointer hover:underline flex items-center">
              View Report <ArrowRight size={14} className="ml-1" />
            </span>
          </div>
          <div className="h-[300px]">
            {orderTrendData.some(d => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    formatter={(val: number) => [formatCurrency(val), 'Revenue']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <TrendingUp size={48} className="mb-2 opacity-20" />
                <p>No recent order data found</p>
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Inventory by Category</h3>
          <div className="h-[300px]">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Package size={48} className="mb-2 opacity-20" />
                <p>No products added yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Recent Sales Orders</h3>
            <Link to="/orders" className="text-xs text-indigo-600 font-bold hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {state.orders.length > 0 ? state.orders.slice(0, 5).map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-indigo-600">{order.invoiceNumber}</td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(order.grandTotal)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(order.date)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">No orders logged yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Stock Alerts</h3>
            <Link to="/products" className="text-xs text-indigo-600 font-bold hover:underline">Manage Stock</Link>
          </div>
          <div className="p-4 space-y-3">
            {state.products.filter(p => p.stockQuantity <= p.minThreshold).length > 0 ? (
              state.products
                .filter(p => p.stockQuantity <= p.minThreshold)
                .slice(0, 5)
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{p.name}</p>
                        <p className="text-xs text-red-600 font-medium">Stock: {p.stockQuantity} {p.unit}</p>
                      </div>
                    </div>
                    <Link 
                      to="/products" 
                      className="px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700 uppercase tracking-wider"
                    >
                      Refill
                    </Link>
                  </div>
                ))
            ) : (
              <div className="py-8 text-center text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-10" />
                <p className="italic">All items are sufficiently stocked</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
