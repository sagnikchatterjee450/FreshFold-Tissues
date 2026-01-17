
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

/**
 * Logo handling:
 * - If you prefer embedding the image directly, set `LOGO_BASE64` to a data URL string (data:image/png;base64,...).
 * - Otherwise place the provided image file at `/freshfold-logo.png` (project `public` folder) and it will be fetched at runtime.
 */
const LOGO_BASE64 = '';

const dataUrlFromBlob = (blob: Blob) => new Promise<string | ArrayBuffer | null>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(blob);
});

// Create a watermark image data URL by drawing the logo onto an offscreen canvas with low opacity
const createWatermarkDataUrl = async (src: string, maxWidth: number) => {
  return new Promise<string>((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / img.width);
          const w = img.width * scale;
          const h = img.height * scale;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context unavailable'));
          ctx.clearRect(0, 0, w, h);
          ctx.globalAlpha = 0.08;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (e) => reject(new Error('Failed to load watermark image'));
      img.src = src;
    } catch (e) {
      reject(e);
    }
  });
};

// Convert number to words (Indian style) for amounts like 1234567.89
const numberToWords = (amount: number) => {
  const units: string[] = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens: string[] = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens: string[] = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (num: number) => {
    if (num === 0) return '';
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + units[num % 10] : '');
    if (num < 1000) return units[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + inWords(num % 100) : '');
    return '';
  };

  const numberToIndian = (num: number) => {
    let result = '';
    const crore = Math.floor(num / 10000000);
    num = num % 10000000;
    const lakh = Math.floor(num / 100000);
    num = num % 100000;
    const thousand = Math.floor(num / 1000);
    num = num % 1000;
    const hundredPlus = num; // up to 999

    if (crore) result += inWords(crore) + ' Crore';
    if (lakh) result += (result ? ' ' : '') + inWords(lakh) + ' Lakh';
    if (thousand) result += (result ? ' ' : '') + inWords(thousand) + ' Thousand';
    if (hundredPlus) result += (result ? ' ' : '') + inWords(hundredPlus);

    return result || 'Zero';
  };

  const rupees = Math.floor(amount);
  const paise = Math.round((Math.abs(amount - rupees) + 1e-9) * 100);

  const rupeesWords = numberToIndian(rupees);
  const paiseWords = paise ? (numberToIndian(paise) + ' Paise') : '';

  let final = `Rupees ${rupeesWords}`;
  if (paise) final += ` and ${paiseWords}`;
  final += ' Only';
  return final;
};

interface OrdersProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Orders: React.FC<OrdersProps> = ({ state, updateState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  
  const { 
    items: cart, 
    customerName, 
    customerPhone,
    customerAddress,
    customerGstin, 
    discountPercentage 
  } = state.cartSession;

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
          customerPhone: '',
          customerAddress: '',
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
      customerPhone,
      customerAddress,
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
          customerPhone: '',
          customerAddress: '',
          customerGstin: '',
          discountPercentage: 0
        }
      };
    });

    setIsModalOpen(false);
    setSelectionQuantities({});
    alert("Order successfully created!");
  };

  const generatePDF = async (order: Order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // Draw a page border around the printable area
    try {
      const borderOffset = Math.max(8, margin / 2);
      doc.setDrawColor(200);
      doc.setLineWidth(0.7);
      doc.rect(borderOffset, borderOffset, pageWidth - borderOffset * 2, pageHeight - borderOffset * 2, 'S');
    } catch (e) {
      console.warn('Failed to draw page border', e);
    }

    // Watermark: attempt to use embedded base64 first, otherwise fetch the public logo,
    // draw it on an offscreen canvas with low opacity and embed centered on the page.
    try {
      let watermarkSrc: string | null = null;
      if (LOGO_BASE64) {
        watermarkSrc = LOGO_BASE64 as string;
      } else {
        try {
          const res = await fetch('/freshfold-logo.png');
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await dataUrlFromBlob(blob);
            if (typeof dataUrl === 'string') watermarkSrc = dataUrl;
          }
        } catch (e) {
          console.warn('Could not fetch logo for watermark', e);
        }
      }

      if (watermarkSrc) {
        const maxW = pageWidth * 0.45; // smaller watermark width for a presentable look
        const wmDataUrl = await createWatermarkDataUrl(watermarkSrc, maxW);
        if (wmDataUrl) {
          // center watermark
          const tmpImg = new Image();
          await new Promise<void>((res, rej) => {
            tmpImg.onload = () => res();
            tmpImg.onerror = () => rej(new Error('watermark load failed'));
            tmpImg.src = wmDataUrl;
          });
          const wmW = tmpImg.width;
          const wmH = tmpImg.height;
          const x = (pageWidth - wmW) / 2;
          const y = (pageHeight - wmH) / 2;
          doc.addImage(wmDataUrl, 'PNG', x, y, wmW, wmH);
        }
      }
    } catch (e) {
      console.warn('Failed to draw watermark', e);
    }

    // Company Header (Left Side)
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.setFont("helvetica", "bold");
    doc.text("CRAFTLINE PRODUCTION", margin, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "italic");
    doc.text("Manufacturer of Fresh Fold Tissue", margin, 27);
    
    doc.setFont("helvetica", "normal");
    doc.text("Contact: +91 9477110150", margin, 33);
    doc.text("Email: craftlineproduction25@gmail.com", margin, 38);

    // Add Logo (Top Right Side)
    let logoDrawn = false;
    const logoSize = 35;
    const logoX = pageWidth - margin - logoSize;
    const logoY = 8;

    try {
      if (LOGO_BASE64) {
        doc.addImage(LOGO_BASE64, 'PNG', logoX, logoY, logoSize, logoSize);
        logoDrawn = true;
      } else {
        try {
          const res = await fetch('/freshfold-logo.png');
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await dataUrlFromBlob(blob);
            if (typeof dataUrl === 'string') {
              doc.addImage(dataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
              logoDrawn = true;
            }
          }
        } catch (e) {
          console.warn('Could not fetch logo from /freshfold-logo.png', e);
        }
      }
    } catch (e) {
      console.error('Error adding logo to PDF', e);
    }

    // Invoice Meta - position below logo if present
    const invoiceMetaStartY = logoDrawn ? (logoY + logoSize + 4) : 33;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Invoice No: ${order.invoiceNumber}`, 140, invoiceMetaStartY);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${formatDate(order.date)}`, 140, invoiceMetaStartY + 5);

    doc.setDrawColor(200);
    doc.line(margin, invoiceMetaStartY + 11, pageWidth - margin, invoiceMetaStartY + 11);

    // Bill To Section
    const billToStartY = invoiceMetaStartY + 19;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.text("BILL TO:", margin, billToStartY);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(order.customerName.toUpperCase(), margin, billToStartY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let currentYHeader = billToStartY + 13;
    
    if (order.customerPhone) {
      doc.setFont("helvetica", "bold");
      doc.text("Phone: ", margin, currentYHeader);
      doc.setFont("helvetica", "normal");
      doc.text(order.customerPhone, margin + 14, currentYHeader);
      currentYHeader += 5;
    }
    
    if (order.customerAddress) {
      doc.setFont("helvetica", "bold");
      doc.text("Address: ", margin, currentYHeader);
      doc.setFont("helvetica", "normal");
      const splitAddress = doc.splitTextToSize(order.customerAddress, 80);
      doc.text(splitAddress, margin + 14, currentYHeader);
      currentYHeader += (splitAddress.length * 4.5);
    }
    
    if (order.customerGstin) {
      doc.setFont("helvetica", "bold");
      doc.text("GSTIN: ", margin, currentYHeader);
      doc.setFont("helvetica", "normal");
      doc.text(order.customerGstin, margin + 14, currentYHeader);
      currentYHeader += 5;
    }

    // Product Table
    autoTable(doc, {
      startY: Math.max(75, currentYHeader + 5),
      head: [['Sl.', 'Product Description', 'Qty', 'Unit Price', 'GST %', 'Total (INR)']],
      body: order.items.map((item, i) => [
        i + 1,
        item.productName,
        item.quantity,
        item.unitPrice.toFixed(2),
        item.gstPercentage + '%',
        item.totalWithGst.toFixed(2)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10 },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'right' }
      },
      margin: { left: margin, right: margin }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Summary Section Positioning
    const rightMarginX = pageWidth - margin;
    const summaryLabelX = 135;
    let currentYSummary = finalY;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text("Subtotal:", summaryLabelX, currentYSummary);
    doc.text(order.totalAmount.toFixed(2), rightMarginX, currentYSummary, { align: 'right' });
    
    if (order.discountAmount > 0) {
      currentYSummary += 7;
      doc.setTextColor(220, 38, 38);
      doc.text(`Discount (${order.discountPercentage}%):`, summaryLabelX, currentYSummary);
      doc.text(`- ${order.discountAmount.toFixed(2)}`, rightMarginX, currentYSummary, { align: 'right' });
      doc.setTextColor(0);
    }

    currentYSummary += 7;
    doc.text("Total GST Amount:", summaryLabelX, currentYSummary);
    doc.text(order.totalGst.toFixed(2), rightMarginX, currentYSummary, { align: 'right' });

    currentYSummary += 10;
    doc.setDrawColor(200);
    doc.line(summaryLabelX, currentYSummary - 6, rightMarginX, currentYSummary - 6);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", summaryLabelX, currentYSummary);
    doc.text(`INR ${order.grandTotal.toFixed(2)}`, rightMarginX, currentYSummary, { align: 'right' });

    // Terms and Conditions Section
    // Amount in words (placed below grand total, above terms)
    try {
      const amountWords = numberToWords(order.grandTotal);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      const wordsY = currentYSummary + 12;
      // wrap text to fit page width (left margin to summaryLabelX - 8)
      const availableWidth = summaryLabelX - margin - 4;
      const split = doc.splitTextToSize(amountWords, availableWidth);
      doc.text('Amount (in words):', margin, wordsY);
      doc.text(split, margin + 36, wordsY);
    } catch (e) {
      console.warn('Failed to render amount in words', e);
    }

    const footerY = 255;
    const termsY = Math.max(footerY - 65, currentYSummary + 15);
    
    // Add Payment QR Code
    try {
      const qrCodeSize = 30;
      const qrCodeX = pageWidth - margin - qrCodeSize - 30;
      const qrCodeY = termsY - 40;
      
      try {
        const res = await fetch('/qrcode-freshfold.jpeg');
        if (res.ok) {
          const blob = await res.blob();
          const dataUrl = await dataUrlFromBlob(blob);
          if (typeof dataUrl === 'string') {
            doc.addImage(dataUrl, 'JPEG', qrCodeX, qrCodeY, qrCodeSize, qrCodeSize);
            
            // Add QR label below
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(79, 70, 229);
            doc.text("Scan for Payment", qrCodeX, qrCodeY + qrCodeSize + 3);
          }
        }
      } catch (e) {
        console.warn('Could not fetch QR code image', e);
      }
    } catch (e) {
      console.warn('Failed to add QR code to PDF', e);
    }
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Terms and conditions:", margin, termsY);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50);
    doc.text("1. Product once sold will not be taken back.", margin, termsY + 6);
    doc.text("2. Payment should be made within time.", margin, termsY + 11);
    doc.text("3. Avail special discount with bulk order.", margin, termsY + 16);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.text("Thank you for making business with us.", margin, termsY + 25);

    // Signatures
    doc.setDrawColor(180);
    doc.line(margin, footerY, 74, footerY);
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Receiver's Signature", margin, footerY + 5);

    doc.line(136, footerY, pageWidth - margin, footerY);
    doc.text("For CRAFTLINE PRODUCTION", 136, footerY - 15);
    doc.text("Authorized Signatory & Stamp", 136, footerY + 5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text("Computer Generated Invoice - Valid without manual signature if stamped by the firm.", margin, 285, { align: 'left' });

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
                    {order.customerPhone && <p className="text-[10px] text-gray-500">{order.customerPhone}</p>}
                    {order.customerGstin && <p className="text-[10px] font-mono text-gray-400">{order.customerGstin}</p>}
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
                      onClick={() => void generatePDF(order)}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[85vh] flex flex-col overflow-hidden">
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

              <div className="w-full lg:w-[400px] bg-gray-50 p-4 sm:p-5 overflow-y-auto flex flex-col border-t lg:border-t-0 lg:border-l border-gray-100 shadow-inner">
                <div className="space-y-4 mb-6">
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-1 mb-2">Customer Details</h3>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Populate from Vendor</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-400"
                          value={selectedVendorId}
                          onChange={(e) => {
                            const vid = e.target.value;
                            setSelectedVendorId(vid);
                            if (!vid) {
                              // clear
                              updateSessionField('customerName', '');
                              updateSessionField('customerPhone', '');
                              updateSessionField('customerAddress', '');
                              updateSessionField('customerGstin', '');
                              return;
                            }
                            const vendor = state.vendors.find(v => v.id === vid);
                            if (vendor) {
                              updateSessionField('customerName', vendor.name || '');
                              updateSessionField('customerPhone', vendor.contact || '');
                              updateSessionField('customerAddress', vendor.address || '');
                              updateSessionField('customerGstin', vendor.gstin || '');
                            }
                          }}
                        >
                          <option value="">-- Select vendor to populate --</option>
                          {state.vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Full Name *</label>
                      <input 
                        required 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-400 font-medium" 
                        placeholder="e.g. Rahul Sharma" 
                        value={customerName}
                        onChange={(e) => updateSessionField('customerName', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Phone</label>
                        <input 
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-400" 
                          placeholder="9876543210" 
                          value={customerPhone}
                          onChange={(e) => updateSessionField('customerPhone', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">GSTIN</label>
                        <input 
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50/50 font-mono outline-none focus:ring-2 focus:ring-indigo-400" 
                          placeholder="Optional" 
                          value={customerGstin}
                          onChange={(e) => updateSessionField('customerGstin', e.target.value.toUpperCase())}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Address</label>
                      <textarea 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-400 resize-none h-16" 
                        placeholder="Billing/Delivery address" 
                        value={customerAddress}
                        onChange={(e) => updateSessionField('customerAddress', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Special Discount (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-400 font-bold" 
                        placeholder="0.0" 
                        value={discountPercentage || ''}
                        onChange={(e) => updateSessionField('discountPercentage', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center">
                    <ShoppingCart size={16} className="mr-2 text-indigo-600" /> Current Cart
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
                    <span className="text-sm font-bold text-gray-900">Total Payable</span>
                    <span className="text-lg font-black text-indigo-700 tracking-tight">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                  
                  <button 
                    onClick={handleCreateOrder}
                    disabled={cart.length === 0 || !customerName}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none transition-all flex items-center justify-center space-x-2"
                  >
                    <CreditCard size={18} />
                    <span>Complete Sale & Print</span>
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
