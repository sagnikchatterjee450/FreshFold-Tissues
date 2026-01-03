
export type Category = 'Facial Tissue' | 'Toilet Roll' | 'Napkins' | 'Jumbo Rolls' | 'Kitchen Towels' | 'Other';
export type Unit = 'packs' | 'cartons' | 'rolls' | 'kg';
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Delivered';
export type Role = 'Admin' | 'Vendor';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: Category;
  unit: Unit;
  costPrice: number;
  sellingPrice: number;
  gstPercentage: number;
  stockQuantity: number;
  minThreshold: number;
}

export interface Vendor {
  id: string;
  name: string;
  gstin: string;
  contact: string;
  address: string;
}

export interface VendorRequest {
  id: string;
  vendorId: string;
  vendorName: string;
  productId: string;
  productName: string;
  quantity: number;
  expectedDate: string;
  status: RequestStatus;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstPercentage: number;
  subtotal: number;
  totalWithGst: number;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string; // Could be vendorId or external customer
  customerName: string;
  customerGstin?: string;
  items: OrderItem[];
  totalAmount: number;
  totalGst: number;
  grandTotal: number;
}

export interface AppState {
  products: Product[];
  vendors: Vendor[];
  requests: VendorRequest[];
  orders: Order[];
}
