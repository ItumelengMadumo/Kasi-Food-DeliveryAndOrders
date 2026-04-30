// ─────────────────────────────────────────────────
// Kasi Food Delivery — Shared TypeScript Types
// ─────────────────────────────────────────────────

export type Role = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

export type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DeliveryType = 'PERCENTAGE' | 'FLAT';

export type DeliveryMethod = 'PICKUP' | 'DELIVERY';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentMethod =
  | 'DIGITAL'
  | 'CASH_ON_DELIVERY'
  | 'CASH_ON_PICKUP'
  | 'EFT';

export interface User {
  id: string;
  name?: string;
  phone: string;
  email?: string;
  role: Role;
  isGuest: boolean;
  createdAt: string;
}

export interface GuestDetails {
  name: string;
  phone: string;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface WorkingHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branchCode: string;
}

export interface Vendor {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  location?: Location;
  contactDetails?: string;
  workingHours?: WorkingHours;
  bankDetails?: BankDetails;
  status: VendorStatus;
  deliveryType?: DeliveryType;
  deliveryValue?: number;
  hasBankAccount: boolean;
  whatsappNumber?: string;
  refPrefix?: string;
  imageUrl?: string;
  description?: string;
  rating?: number;
  totalReviews?: number;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  category?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderSource = 'WEB' | 'WHATSAPP' | 'MANUAL';

export interface Order {
  id: string;
  orderNumber?: string;
  paymentRef?: string;
  customerId?: string;
  guestDetails?: GuestDetails;
  vendorId: string;
  vendor?: Vendor;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  deliveryFee?: number;
  subtotal: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: string;
  contactPhone: string;
  specialInstructions?: string;
  source?: OrderSource;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  vendorId: string;
  userId?: string;
  guestName?: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface VendorApplication {
  id: string;
  applicantName: string;
  phone: string;
  email?: string;
  businessName: string;
  address: string;
  description?: string;
  hasBankAccount: boolean;
  whatsappNumber?: string;
  status: VendorStatus;
  createdAt: string;
}

// Cart types (frontend-only)
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface Cart {
  vendorId: string;
  items: CartItem[];
}
