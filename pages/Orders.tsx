
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  ShoppingCart, 
  Trash2, 
  X, 
  CreditCard,
  Percent,
  RotateCcw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState, Order, OrderItem } from '../types';
import { formatCurrency, formatDate, generateId } from '../utils/format';

interface OrdersProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Orders: React.FC<OrdersProps> = ({ state, updateState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Destructure cart session from global state
  const { items: cart, customerName, customerGstin, discountPercentage } = state.cartSession;

  // Local UI state for typed quantities in the product list
  const [selectionQuantities, setSelectionQuantities] = useState<Record<string, string>>({});

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
    const rawSubtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = (rawSubtotal * discountPercentage) / 100;
    const taxableAmount = rawSubtotal - discountAmount;
    
    const rawGstTotal = cartItems.reduce((sum, item) => sum + (item.total - item.subtotal), 0);
    const finalGst = rawSubtotal > 0 ? (rawGstTotal * (taxableAmount / rawSubtotal)) : 0;
    
    return { 
      amount: rawSubtotal, 
      discountAmount, 
      taxableAmount,
      gst: finalGst, 
      grandTotal: taxableAmount + finalGst 
    };
  }, [cartItems, discountPercentage]);

  const handleAddToCart = (productId: string) => {
    const typedQty = parseInt(selectionQuantities[productId] || '1');
    if (isNaN(typedQty) || typedQty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    if (product.stockQuantity === 0) {
      alert("Product out of stock!");
      return;
    }

    updateState(prev => {
      const existing = prev.cartSession.items.find(i => i.productId === productId);
      const currentQtyInCart = existing?.quantity || 0;
      const newTotalQty = currentQtyInCart + typedQty;
      
      if (newTotalQty > product.stockQuantity) {
        alert(`Insufficient stock. Total available: ${product.stockQuantity}`);
        return prev;
      }

      let newItems;
      if (existing) {
        newItems = prev.cartSession.items.map(i => i.productId === productId ? { ...i, quantity: newTotalQty } : i);
      } else {
        newItems = [...prev.cartSession.items, { productId, quantity: typedQty }];
      }

      return {
        ...prev,
        cartSession: { ...prev.cartSession, items: newItems }
      };
    });

    // Reset quantity field for this product
    setSelectionQuantities(prev => ({ ...prev, [productId]: '' }));
  };

  const updateCartQuantity = (productId: string, newQtyStr: string) => {
    const newQty = parseInt(newQtyStr);
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    if (isNaN(newQty) || newQty < 0) return;
    
    if (newQty > product.stockQuantity) {
      alert(`Insufficient stock. Maximum available: ${product.stockQuantity}`);
      return;
    }

    updateState(prev => ({
      ...prev,
      cartSession: {
        ...prev.cartSession,
        items: prev.cartSession.items.map(i => i.productId === productId ? { ...i, quantity: newQty } : i)
      }
    }));
  };

  const removeFromCart = (productId: string) => {
    updateState(prev => ({
      ...prev,
      cartSession: {
        ...prev.cartSession,
        items: prev.cartSession.items.filter(i => i.productId !== productId)
      }
    }));
  };

  const updateSessionField = (field: keyof typeof state.cartSession, value: any) => {
    updateState(prev => ({
      ...prev,
      cartSession: { ...prev.cartSession, [field]: value }
    }));
  };

  const resetSession = () => {
    if (confirm('Clear the current cart session?')) {
      updateState(prev => ({
        ...prev,
        cartSession: {
          items: [],
          customerName: '',
          customerGstin: '',
          discountPercentage: 0
        }
      }));
    }
  };

  const handleCreateOrder = () => {
    const validCart = cartItems.filter(item => item.quantity > 0);
    
    if (!customerName || validCart.length === 0) {
      alert("Please enter a customer name and ensure cart has items with quantities.");
      return;
    }

    const orderItems: OrderItem[] = validCart.map(item => ({
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
      discountPercentage: discountPercentage,
      discountAmount: totals.discountAmount,
      grandTotal: totals.grandTotal,
    };

    updateState(prev => {
      const updatedProducts = prev.products.map(p => {
        const cartItem = validCart.find(ci => ci.productId === p.id);
        if (cartItem) {
          return { ...p, stockQuantity: p.stockQuantity - cartItem.quantity };
        }
        return p;
      });

      return {
        ...prev,
        products: updatedProducts,
        orders: [newOrder, ...prev.orders],
        cartSession: {
          items: [],
          customerName: '',
          customerGstin: '',
          discountPercentage: 0
        }
      };
    });

    setIsModalOpen(false);
    setSelectionQuantities({});
    alert("Order successfully created!");
  };

  const generatePDF = (order: Order) => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.setFont("helvetica", "bold");
    doc.text("CRAFTLINE PRODUCTION", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "italic");
    doc.text("Manufacturer of Fresh Fold Tissue", 14, 27);
    
    doc.setFont("helvetica", "normal");
    doc.text("Contact: 9477110150", 14, 33);
    doc.text("Email: craftlineproduction25@gmail.com", 14, 38);

    doc.setDrawColor(200);
    doc.line(14, 44, 196, 44);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("INVOICE TO:", 14, 54);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(order.customerName, 14, 61);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (order.customerGstin) doc.text(`GSTIN: ${order.customerGstin}`, 14, 67);

    doc.setFontSize(11);
    doc.text(`Invoice No: ${order.invoiceNumber}`, 140, 54);
    doc.text(`Date: ${formatDate(order.date)}`, 140, 60);

    autoTable(doc, {
      startY: 75,
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
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    
    let currentY = finalY;
    doc.text("Subtotal:", 140, currentY);
    doc.text(`INR ${order.totalAmount.toFixed(2)}`, 170, currentY);
    
    if (order.discountAmount > 0) {
      currentY += 7;
      doc.setTextColor(220, 38, 38);
      doc.text(`Discount (${order.discountPercentage}%):`, 140, currentY);
      doc.text(`- INR ${order.discountAmount.toFixed(2)}`, 170, currentY);
      doc.setTextColor(0);
    }

    currentY += 7;
    doc.text("Total GST:", 140, currentY);
    doc.text(`INR ${order.totalGst.toFixed(2)}`, 170, currentY);

    currentY += 9;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", 140, currentY);
    doc.text(`INR ${order.grandTotal.toFixed(2)}`, 170, currentY);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text("Thank you for choosing Craftline Production! This is a computer generated invoice.", 14, 280);

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
        <div className="flex items-center space-x-2">
          {cart.length > 0 && (
             <button 
              onClick={resetSession}
              className="p-2 text-red-500 bg-white border border-gray-200 rounded-lg hover:bg-red-50 shadow-sm transition-colors"
              title="Clear Cart Session"
            >
              <RotateCcw size={20} />
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-all font-semibold"
          >
            <Plus size={20} />
            <span>{cart.length > 0 ? `Continue Sale (${cart.length})` : 'New Sale Order'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Invoice No</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Discount</th>
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
                    {order.discountPercentage > 0 ? (
                      <span className="text-red-600 font-medium">-{order.discountPercentage}%</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md">
          {/* Reduced max-width from 6xl to 5xl and height to 80vh for a more compact feel */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-bold text-gray-900">Create New Sales Order</h2>
                <button 
                  onClick={resetSession}
                  className="flex items-center space-x-1 text-[10px] text-red-500 hover:text-red-700 font-bold bg-red-50 px-2 py-1 rounded"
                >
                  <RotateCcw size={10} />
                  <span>RESET FORM</span>
                </button>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Product Selection Area */}
              <div className="flex-1 p-4 sm:p-5 overflow-y-auto border-r border-gray-100 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {state.products.map(product => (
                    <div 
                      key={product.id} 
                      className={`p-3 rounded-xl border transition-all ${product.stockQuantity === 0 ? 'bg-gray-50 opacity-60 grayscale' : 'bg-white border-gray-100 shadow-sm hover:border-indigo-300'}`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[9px] font-bold uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{product.category}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${product.stockQuantity < product.minThreshold ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          Stock: {product.stockQuantity}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 mb-0.5 leading-tight text-sm truncate">{product.name}</h4>
                      <p className="text-indigo-600 font-bold text-xs mb-3">{formatCurrency(product.sellingPrice)}</p>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number"
                            placeholder="Qty"
                            min="1"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50 font-bold"
                            value={selectionQuantities[product.id] || ''}
                            onChange={(e) => setSelectionQuantities(prev => ({ ...prev, [product.id]: e.target.value }))}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddToCart(product.id)}
                            disabled={product.stockQuantity === 0}
                          />
                        </div>
                        <button 
                          onClick={() => handleAddToCart(product.id)}
                          disabled={product.stockQuantity === 0}
                          className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 text-xs font-bold transition-all flex items-center space-x-1 active:scale-95"
                        >
                          <Plus size={14} />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cart Summary Sidebar - Narrowed from 450px to 380px */}
              <div className="w-full lg:w-[380px] bg-gray-50 p-4 sm:p-5 overflow-y-auto flex flex-col border-t lg:border-t-0 lg:border-l border-gray-100 shadow-inner">
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Customer Name</label>
                    <input 
                      required 
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-medium" 
                      placeholder="Enter full name" 
                      value={customerName}
                      onChange={(e) => updateSessionField('customerName', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">GSTIN</label>
                      <input 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white font-mono outline-none focus:ring-2 focus:ring-indigo-400" 
                        placeholder="Optional" 
                        value={customerGstin}
                        onChange={(e) => updateSessionField('customerGstin', e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Disc (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-bold" 
                          placeholder="0.0" 
                          value={discountPercentage || ''}
                          onChange={(e) => updateSessionField('discountPercentage', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center">
                    <ShoppingCart size={16} className="mr-2 text-indigo-600" /> Bill Summary
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{cart.length} Items</span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto mb-4 pr-1 min-h-[150px] lg:min-h-0">
                  {cartItems.length > 0 ? cartItems.map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 group transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-gray-900 truncate pr-2 flex-1">{item.name}</p>
                        <button 
                          onClick={() => removeFromCart(item.productId)}
                          className="text-gray-400 hover:text-red-500 p-1 transition-colors rounded hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number"
                            min="0"
                            className="w-14 px-1.5 py-1 border border-gray-200 rounded-lg bg-gray-50 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-300"
                            value={item.quantity || ''}
                            onChange={(e) => updateCartQuantity(item.productId, e.target.value)}
                          />
                          <span className="text-[10px] font-medium text-gray-400">× {formatCurrency(item.price)}</span>
                        </div>
                        <p className="text-xs font-bold text-gray-900">{formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                      <ShoppingCart size={32} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-gray-400 text-[10px] font-medium italic">Empty Cart</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-gray-200 pt-3 bg-gray-50 sticky bottom-0">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">Subtotal</span>
                    <span className="font-bold text-gray-800">{formatCurrency(totals.amount)}</span>
                  </div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-red-500 font-bold">Discount ({discountPercentage}%)</span>
                      <span className="font-bold text-red-600">-{formatCurrency(totals.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">GST</span>
                    <span className="font-bold text-indigo-600">{formatCurrency(totals.gst)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-dashed border-gray-300 mt-1">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-lg font-black text-indigo-700 tracking-tight">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                  
                  <button 
                    onClick={handleCreateOrder}
                    disabled={cart.length === 0 || !customerName}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none transition-all flex items-center justify-center space-x-2"
                  >
                    <CreditCard size={18} />
                    <span>Generate Invoice</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
