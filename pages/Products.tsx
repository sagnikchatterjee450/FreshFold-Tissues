
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  Package, 
  MoreVertical,
  Download,
  X
} from 'lucide-react';
import { AppState, Product, Category, Unit } from '../types';
import { formatCurrency, generateId } from '../utils/format';

interface ProductsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const CATEGORIES: Category[] = ['Facial Tissue', 'Toilet Roll', 'Napkins', 'Jumbo Rolls', 'Kitchen Towels', 'Other'];
const UNITS: Unit[] = ['packs', 'cartons', 'rolls', 'kg'];

const Products: React.FC<ProductsProps> = ({ state, updateState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    return state.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [state.products, searchTerm, filterCategory]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      updateState(prev => ({
        ...prev,
        products: prev.products.filter(p => p.id !== id)
      }));
    }
  };

  const handleExportCSV = () => {
    const headers = ['SKU', 'Name', 'Category', 'Stock', 'Unit', 'Cost Price', 'Selling Price', 'Threshold'];
    const rows = state.products.map(p => [
      p.sku, p.name, p.category, p.stockQuantity, p.unit, p.costPrice, p.sellingPrice, p.minThreshold
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <select 
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button 
            onClick={handleExportCSV}
            className="p-2 text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50"
            title="Export CSV"
          >
            <Download size={20} />
          </button>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-all font-semibold"
          >
            <Plus size={20} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-center">Stock Status</th>
                <th className="px-6 py-4">Price (INR)</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length > 0 ? filteredProducts.map(product => {
                const isLowStock = product.stockQuantity <= product.minThreshold && product.stockQuantity > 0;
                const isOutOfStock = product.stockQuantity === 0;

                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500 font-mono">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center">
                        <div className={`text-sm font-bold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {product.stockQuantity} {product.unit}
                        </div>
                        {isOutOfStock ? (
                          <span className="text-[10px] text-red-500 font-bold uppercase">Out of Stock</span>
                        ) : isLowStock ? (
                          <span className="text-[10px] text-amber-500 font-bold uppercase">Low Stock</span>
                        ) : (
                          <span className="text-[10px] text-emerald-500 font-bold uppercase">Healthy</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-500">CP: {formatCurrency(product.costPrice)}</p>
                      <p className="font-bold text-gray-900">SP: {formatCurrency(product.sellingPrice)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                    <div className="flex flex-col items-center">
                      <Package size={48} className="mb-4 opacity-10" />
                      <p>No products match your criteria.</p>
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="mt-4 text-indigo-600 font-bold hover:underline"
                      >
                        Add your first product
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50/50">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProduct ? 'Update Product Details' : 'Register New Product'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form className="p-6 overflow-y-auto max-h-[80vh]" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              const product: Product = {
                id: editingProduct?.id || generateId('PRD'),
                sku: data.sku as string,
                name: data.name as string,
                category: data.category as Category,
                unit: data.unit as Unit,
                costPrice: Number(data.costPrice),
                sellingPrice: Number(data.sellingPrice),
                gstPercentage: Number(data.gstPercentage),
                stockQuantity: Number(data.stockQuantity),
                minThreshold: Number(data.minThreshold),
              };

              updateState(prev => {
                const products = [...prev.products];
                if (editingProduct) {
                  const idx = products.findIndex(p => p.id === editingProduct.id);
                  products[idx] = product;
                } else {
                  products.push(product);
                }
                return { ...prev, products };
              });
              setIsModalOpen(false);
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Product Name *</label>
                  <input required name="name" defaultValue={editingProduct?.name} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Toilet Roll 2-Ply" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">SKU / Product ID *</label>
                  <input required name="sku" defaultValue={editingProduct?.sku} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. TR-2P-001" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Category</label>
                  <select name="category" defaultValue={editingProduct?.category} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Base Unit</label>
                  <select name="unit" defaultValue={editingProduct?.unit} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Cost Price (₹)</label>
                  <input required type="number" step="0.01" name="costPrice" defaultValue={editingProduct?.costPrice} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Selling Price (₹)</label>
                  <input required type="number" step="0.01" name="sellingPrice" defaultValue={editingProduct?.sellingPrice} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">GST %</label>
                  <input required type="number" name="gstPercentage" defaultValue={editingProduct?.gstPercentage || 18} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Current Stock</label>
                  <input required type="number" name="stockQuantity" defaultValue={editingProduct?.stockQuantity || 0} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Min. Threshold Alert</label>
                  <input required type="number" name="minThreshold" defaultValue={editingProduct?.minThreshold || 10} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end space-x-3 border-t border-gray-100 pt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-bold transition-all"
                >
                  {editingProduct ? 'Apply Changes' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
