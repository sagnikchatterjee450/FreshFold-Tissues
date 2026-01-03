
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Download, 
  ShoppingCart, 
  Trash2, 
  User,
  Package,
  X,
  CreditCard,
  Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState, Order, OrderItem, Product } from '../types';
import { formatCurrency, formatDate, generateId } from '../utils/format';

interface OrdersProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Orders: React.FC<OrdersProps> = ({ state, updateState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');

  const filteredOrders = state.orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartItems = useMemo(() => {
    return cart.map(item => {
      const product = state.products.find(p => p.id === item.productId);
      if (!product) return null;
      
      const subtotal = product.sellingPrice * item.quantity;
      const gstAmount = (subtotal * product.gstPercentage) / 100;
      
      return {
        ...item,
        name: product.name,
        price: product.sellingPrice,
        gst: product.gstPercentage,
        subtotal,
        total: subtotal + gstAmount
      };
    }).filter(Boolean) as any[];
  }, [cart, state.products]);

  const totals = useMemo(() => {
    const amount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const gst = cartItems.reduce((sum, item) => sum + (item.total - item.subtotal), 0);
    return { amount, gst, grandTotal: amount + gst };
  }, [cartItems]);

  const handleAddToCart = (productId: string) => {
    const product = state.products.find(p => p.id === productId);
    if (!product || product.stockQuantity === 0) {
      alert("Product out of stock!");
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          alert("Insufficient stock available!");
          return prev;
        }
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const handleCreateOrder = () => {
    if (!customerName || cart.length === 0) {
      alert("Please fill in customer name and add items to cart.");
      return;
    }

    const orderItems: OrderItem[] = cartItems.map(item => ({
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      gstPercentage: item.gst,
      subtotal: item.subtotal,
      totalWithGst: item.total,
    }));

    const newOrder: Order = {
      id: generateId('ORD'),
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      customerId: generateId('CUS'),
      customerName,
      customerGstin,
      items: orderItems,
      totalAmount: totals.amount,
      totalGst: totals.gst,
      grandTotal: totals.grandTotal,
    };

    updateState(prev => {
      // Deduct stock
      const updatedProducts = prev.products.map(p => {
        const cartItem = cart.find(ci => ci.productId === p.id);
        if (cartItem) {
          return { ...p, stockQuantity: p.stockQuantity - cartItem.quantity };
        }
        return p;
      });

      return {
        ...prev,
        products: updatedProducts,
        orders: [newOrder, ...prev.orders]
      };
    });

    setIsModalOpen(false);
    setCart([]);
    setCustomerName('');
    setCustomerGstin('');
    alert("Order created successfully! You can download the invoice from the orders table.");
  };

  const generatePDF = (order: Order) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text("FRESHFOLD TISSUES", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Contact: 9038187747", 14, 28);

    // Divider
    doc.setDrawColor(200);
    doc.line(14, 35, 196, 35);

    // Order Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("INVOICE TO:", 14, 45);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(order.customerName, 14, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (order.customerGstin) doc.text(`GSTIN: ${order.customerGstin}`, 14, 58);

    doc.setFontSize(11);
    doc.text(`Invoice No: ${order.invoiceNumber}`, 140, 45);
    doc.text(`Date: ${formatDate(order.date)}`, 140, 51);

    // Table
    autoTable(doc, {
      startY: 70,
      head: [['Sl.', 'Product Name', 'Qty', 'Unit Price', 'GST%', 'Total (₹)']],
      body: order.items.map((item, i) => [
        i + 1,
        item.productName,
        item.quantity,
        item.unitPrice.toFixed(2),
        item.gstPercentage + '%',
        item.totalWithGst.toFixed(2)
      ]),
      theme: 'striped',
      headStyles: { fillStyle: 'f', fillColor: [79, 70, 229] },
      styles: { fontSize: 9 }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text("Subtotal:", 140, finalY);
    doc.text(`INR ${order.totalAmount.toFixed(2)}`, 170, finalY);
    
    doc.text("Total GST:", 140, finalY + 7);
    doc.text(`INR ${order.totalGst.toFixed(2)}`, 170, finalY + 7);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", 140, finalY + 16);
    doc.text(`INR ${order.grandTotal.toFixed(2)}`, 170, finalY + 16);

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text("Thank you for your business! This is a computer generated invoice.", 14, 280);

    doc.save(`${order.invoiceNumber}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search orders or clients..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-all font-semibold"
        >
          <Plus size={20} />
          <span>New Sale Order</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Invoice No</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length > 0 ? filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-indigo-600">{order.invoiceNumber}</td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{order.customerName}</p>
                    {order.customerGstin && <p className="text-[10px] font-mono text-gray-500">{order.customerGstin}</p>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {order.items.length} product(s)
                  </td>
                  <td className="px-6 py-4">
                    {formatDate(order.date)}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {formatCurrency(order.grandTotal)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => generatePDF(order)}
                      className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-3 py-1.5 rounded-md transition-colors"
                    >
                      <Download size={14} />
                      <span className="text-xs uppercase">PDF</span>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-10" />
                    <p>No sales orders created yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create New Sales Order</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left: Product Selection */}
              <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100">
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm" 
                    placeholder="Search product to add..." 
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {state.products.map(product => (
                    <div 
                      key={product.id} 
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${product.stockQuantity === 0 ? 'bg-gray-50 opacity-60 grayscale cursor-not-allowed' : 'bg-white hover:border-indigo-500 border-gray-100 hover:shadow-md'}`}
                      onClick={() => handleAddToCart(product.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{product.category}</span>
                        <span className={`text-[10px] font-bold ${product.stockQuantity < product.minThreshold ? 'text-amber-600' : 'text-emerald-600'}`}>
                          In Stock: {product.stockQuantity}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 mb-1">{product.name}</h4>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-indigo-600 font-bold">{formatCurrency(product.sellingPrice)}</span>
                        <Plus size={18} className="text-indigo-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Checkout Summary */}
              <div className="w-full md:w-96 bg-gray-50 p-6 overflow-y-auto flex flex-col">
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Customer Name</label>
                    <input 
                      required 
                      className="w-full px-4 py-2 mt-1 border border-gray-200 rounded-lg text-sm bg-white" 
                      placeholder="Enter customer name" 
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">GSTIN (Optional)</label>
                    <input 
                      className="w-full px-4 py-2 mt-1 border border-gray-200 rounded-lg text-sm bg-white font-mono" 
                      placeholder="22AAAAA0000A1Z5" 
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2 flex items-center">
                  <ShoppingCart size={16} className="mr-2" /> Cart Items
                </h3>

                <div className="flex-1 space-y-3 overflow-y-auto mb-6 pr-2">
                  {cartItems.length > 0 ? cartItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex-1">
                        <p className="text-xs font-bold truncate pr-2">{item.name}</p>
                        <p className="text-[10px] text-gray-500">{item.quantity} x {formatCurrency(item.price)}</p>
                      </div>
                      <div className="text-right flex items-center space-x-3">
                        <p className="text-xs font-bold">{formatCurrency(item.total)}</p>
                        <button 
                          onClick={() => removeFromCart(item.productId)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 text-gray-400 italic text-sm">Cart is empty</div>
                  )}
                </div>

                <div className="space-y-2 border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-semibold">{formatCurrency(totals.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GST Total</span>
                    <span className="font-semibold text-indigo-600">{formatCurrency(totals.gst)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-dashed border-gray-300 pt-2 mt-2">
                    <span>Payable</span>
                    <span className="text-indigo-700">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>

                <button 
                  onClick={handleCreateOrder}
                  disabled={cart.length === 0 || !customerName}
                  className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  <CreditCard size={18} />
                  <span>Generate Order & PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
