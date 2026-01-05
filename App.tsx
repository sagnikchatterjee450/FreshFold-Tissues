
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ClipboardList, 
  ShoppingCart, 
  Menu, 
  X, 
  UserCircle,
  LogOut,
  Bell
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Vendors from './pages/Vendors';
import Requests from './pages/Requests';
import Orders from './pages/Orders';
import { AppState, Role } from './types';

const STORAGE_KEY = 'craftline_inventory_data';

const INITIAL_STATE: AppState = {
  products: [],
  vendors: [],
  requests: [],
  orders: [],
};

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${
        isActive 
          ? 'bg-indigo-700 text-white' 
          : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
};

const useRouteTitle = () => {
  const location = useLocation();
  switch (location.pathname) {
    case '/': return 'Dashboard Overview';
    case '/products': return 'Inventory Management';
    case '/vendors': return 'Vendor Directory';
    case '/requests': return 'Vendor Requests';
    case '/orders': return 'Sales & Invoices';
    default: return 'Craftline Production';
  }
};

interface AppLayoutProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ state, updateState, isSidebarOpen, setIsSidebarOpen }) => {
  const routeTitle = useRouteTitle();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-indigo-900 text-white w-64 flex-shrink-0 transition-transform duration-300 ease-in-out fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-indigo-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl">C</div>
            <span className="text-xl font-bold tracking-tight">Craftline</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          <NavLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavLink to="/products" icon={<Package size={20} />} label="Inventory" />
          <NavLink to="/vendors" icon={<Users size={20} />} label="Vendors" />
          <NavLink to="/requests" icon={<ClipboardList size={20} />} label="Vendor Requests" />
          <NavLink to="/orders" icon={<ShoppingCart size={20} />} label="Sales Orders" />
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-indigo-800">
          <div className="flex items-center space-x-3 text-indigo-200 hover:text-white cursor-pointer transition-colors">
            <UserCircle size={24} />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">Master Admin</p>
              <p className="text-xs truncate opacity-70">admin@craftline.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 md:px-8 z-40">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className={`md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 ${isSidebarOpen ? 'hidden' : 'block'}`}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 px-4">
            <h1 className="text-lg font-semibold text-gray-800">
              {routeTitle}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <button className="p-2 text-gray-400 hover:text-gray-500 transition-colors">
                <Bell size={20} />
              </button>
              {state.products.some(p => p.stockQuantity <= p.minThreshold) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            <button 
              className="flex items-center space-x-2 text-sm text-gray-700 font-medium hover:text-indigo-600 transition-colors"
              onClick={() => alert('Logout clicked')}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard state={state} />} />
            <Route path="/products" element={<Products state={state} updateState={updateState} />} />
            <Route path="/vendors" element={<Vendors state={state} updateState={updateState} />} />
            <Route path="/requests" element={<Requests state={state} updateState={updateState} />} />
            <Route path="/orders" element={<Orders state={state} updateState={updateState} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_STATE;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState(prev => updater(prev));
  };

  return (
    <HashRouter>
      <AppLayout 
        state={state} 
        updateState={updateState} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
      />
    </HashRouter>
  );
};

export default App;
