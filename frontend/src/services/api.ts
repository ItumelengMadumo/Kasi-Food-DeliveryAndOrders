/**
 * AppSync GraphQL client service
 *
 * Uses AWS Amplify v6 to interact with AppSync.
 * Configure aws-amplify before using (see amplifyConfigure.ts).
 */

import { generateClient } from 'aws-amplify/api';
import type {
  Vendor,
  MenuItem,
  Order,
  VendorApplication,
  Review,
  OrderStatus,
  VendorStatus,
  BankDetails,
} from '../types';

// Lazy singleton — generateClient() requires Amplify.configure() to have run first.
// We defer the call until the first actual API request.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function client(): any {
  if (!_client) _client = generateClient();
  return _client;
}

// ── Vendor Queries ────────────────────────────────

export async function getVendor(vendorId: string): Promise<Vendor | null> {
  const query = /* GraphQL */ `
    query GetVendor($vendorId: ID!) {
      getVendor(vendorId: $vendorId) {
        id ownerId name address contactDetails workingHours
        status deliveryType deliveryValue hasBankAccount digitalPaymentsEnabled whatsappNumber refPrefix
        imageUrl description rating totalReviews createdAt
        location { lat lng }
      }
    }
  `;
  const result = await client().graphql({ query, variables: { vendorId } });
  return (result as { data: { getVendor: Vendor | null } }).data.getVendor;
}

export async function getAllVendors(status?: VendorStatus): Promise<Vendor[]> {
  const query = /* GraphQL */ `
    query GetAllVendors($status: VendorStatus) {
      getAllVendors(status: $status) {
        id ownerId name address contactDetails status
        deliveryType deliveryValue hasBankAccount digitalPaymentsEnabled whatsappNumber
        imageUrl description rating totalReviews createdAt
        location { lat lng }
      }
    }
  `;
  const result = await client().graphql({ query, variables: { status } });
  return (result as { data: { getAllVendors: Vendor[] } }).data.getAllVendors;
}

export async function getNearbyVendors(
  lat: number,
  lng: number,
  radiusKm?: number
): Promise<Vendor[]> {
  const query = /* GraphQL */ `
    query GetNearbyVendors($location: LocationInput!, $radiusKm: Float) {
      getNearbyVendors(location: $location, radiusKm: $radiusKm) {
        id name address status deliveryType deliveryValue hasBankAccount digitalPaymentsEnabled
        whatsappNumber contactDetails imageUrl description rating totalReviews createdAt
        location { lat lng }
      }
    }
  `;
  const result = await client().graphql({
    query,
    variables: { location: { lat, lng }, radiusKm },
  });
  return (result as { data: { getNearbyVendors: Vendor[] } }).data.getNearbyVendors;
}

// ── Menu Queries ──────────────────────────────────

export async function getVendorMenu(vendorId: string): Promise<MenuItem[]> {
  const query = /* GraphQL */ `
    query GetVendorMenu($vendorId: ID!) {
      getVendorMenu(vendorId: $vendorId) {
        id vendorId name description price imageUrl available category createdAt
      }
    }
  `;
  const result = await client().graphql({ query, variables: { vendorId } });
  return (result as { data: { getVendorMenu: MenuItem[] } }).data.getVendorMenu;
}

// ── Order Queries ─────────────────────────────────

export async function getOrder(orderId: string): Promise<Order | null> {
  const query = /* GraphQL */ `
    query GetOrder($orderId: ID!) {
      getOrder(orderId: $orderId) {
        id orderNumber paymentRef customerId vendorId status deliveryMethod deliveryFee
        subtotal totalAmount paymentMethod paymentStatus paymentProvider contactPhone specialInstructions
        createdAt updatedAt
        guestDetails { name phone }
        items { id menuItemId name price quantity }
      }
    }
  `;
  const result = await client().graphql({ query, variables: { orderId } });
  return (result as { data: { getOrder: Order | null } }).data.getOrder;
}

export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  const query = /* GraphQL */ `
    query GetCustomerOrders($customerId: ID!) {
      getCustomerOrders(customerId: $customerId) {
        id orderNumber paymentRef vendorId status deliveryMethod totalAmount paymentMethod paymentStatus
        contactPhone createdAt updatedAt
        guestDetails { name phone }
      }
    }
  `;
  const result = await client().graphql({ query, variables: { customerId } });
  return (result as { data: { getCustomerOrders: Order[] } }).data.getCustomerOrders;
}

export async function getVendorOrders(
  vendorId: string,
  status?: OrderStatus
): Promise<Order[]> {
  const query = /* GraphQL */ `
    query GetVendorOrders($vendorId: ID!, $status: OrderStatus) {
      getVendorOrders(vendorId: $vendorId, status: $status) {
        id orderNumber paymentRef customerId vendorId status deliveryMethod deliveryFee
        subtotal totalAmount paymentMethod paymentStatus contactPhone createdAt updatedAt
        guestDetails { name phone }
        items { id menuItemId name price quantity }
      }
    }
  `;
  const result = await client().graphql({
    query,
    variables: { vendorId, status },
    authMode: 'userPool',
  });
  return (result as { data: { getVendorOrders: Order[] } }).data.getVendorOrders;
}

// ── Order Mutations ───────────────────────────────

export interface CreateOrderInput {
  customerId?: string;
  guestDetails?: { name: string; phone: string };
  vendorId: string;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  paymentMethod: string;
  contactPhone: string;
  specialInstructions?: string;
  items: { menuItemId: string; name: string; price: number; quantity: number }[];
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const mutation = /* GraphQL */ `
    mutation CreateOrder($input: CreateOrderInput!) {
      createOrder(input: $input) {
        id orderNumber paymentRef vendorId status deliveryMethod deliveryFee
        subtotal totalAmount paymentMethod contactPhone createdAt updatedAt
        guestDetails { name phone }
      }
    }
  `;
  const result = await client().graphql({ query: mutation, variables: { input } });
  return (result as { data: { createOrder: Order } }).data.createOrder;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<Order> {
  const mutation = /* GraphQL */ `
    mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
      updateOrderStatus(input: $input) {
        id status updatedAt
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { input: { orderId, status } },
    authMode: 'userPool',
  });
  return (result as { data: { updateOrderStatus: Order } }).data.updateOrderStatus;
}

// ── Menu Mutations ────────────────────────────────

export interface CreateMenuItemInput {
  vendorId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  available?: boolean;
}

export async function createMenuItem(input: CreateMenuItemInput): Promise<MenuItem> {
  const mutation = /* GraphQL */ `
    mutation CreateMenuItem($input: CreateMenuItemInput!) {
      createMenuItem(input: $input) {
        id vendorId name description price imageUrl available category createdAt
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { input },
    authMode: 'userPool',
  });
  return (result as { data: { createMenuItem: MenuItem } }).data.createMenuItem;
}

export async function updateMenuItem(input: {
  menuItemId: string;
  vendorId: string;
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  available?: boolean;
}): Promise<MenuItem> {
  const mutation = /* GraphQL */ `
    mutation UpdateMenuItem($input: UpdateMenuItemInput!) {
      updateMenuItem(input: $input) {
        id vendorId name description price imageUrl available category createdAt
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { input },
    authMode: 'userPool',
  });
  return (result as { data: { updateMenuItem: MenuItem } }).data.updateMenuItem;
}

export async function toggleMenuItemAvailability(
  menuItemId: string,
  vendorId: string,
  available: boolean
): Promise<MenuItem> {
  const mutation = /* GraphQL */ `
    mutation ToggleMenuItemAvailability($menuItemId: ID!, $vendorId: ID!, $available: Boolean!) {
      toggleMenuItemAvailability(menuItemId: $menuItemId, vendorId: $vendorId, available: $available) {
        id vendorId name available
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { menuItemId, vendorId, available },
    authMode: 'userPool',
  });
  return (result as { data: { toggleMenuItemAvailability: MenuItem } }).data
    .toggleMenuItemAvailability;
}

export async function deleteMenuItem(
  menuItemId: string,
  vendorId: string
): Promise<boolean> {
  const mutation = /* GraphQL */ `
    mutation DeleteMenuItem($menuItemId: ID!, $vendorId: ID!) {
      deleteMenuItem(menuItemId: $menuItemId, vendorId: $vendorId)
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { menuItemId, vendorId },
    authMode: 'userPool',
  });
  return (result as { data: { deleteMenuItem: boolean } }).data.deleteMenuItem;
}

// ── Vendor Application ────────────────────────────

export interface CreateVendorApplicationInput {
  applicantName: string;
  phone: string;
  email?: string;
  businessName: string;
  address: string;
  description?: string;
  hasBankAccount: boolean;
  whatsappNumber?: string;
  location?: { lat: number; lng: number };
}

export async function createVendorApplication(
  input: CreateVendorApplicationInput
): Promise<VendorApplication> {
  const mutation = /* GraphQL */ `
    mutation CreateVendorApplication($input: CreateVendorApplicationInput!) {
      createVendorApplication(input: $input) {
        id applicantName phone email businessName address description
        hasBankAccount whatsappNumber status createdAt
      }
    }
  `;
  const result = await client().graphql({ query: mutation, variables: { input } });
  return (result as { data: { createVendorApplication: VendorApplication } }).data
    .createVendorApplication;
}

// ── Admin ─────────────────────────────────────────

export async function getPendingVendorApplications(): Promise<VendorApplication[]> {
  const query = /* GraphQL */ `
    query GetPendingVendorApplications {
      getPendingVendorApplications {
        id applicantName phone email businessName address description
        hasBankAccount status createdAt
      }
    }
  `;
  const result = await client().graphql({ query, authMode: 'userPool' });
  return (
    result as { data: { getPendingVendorApplications: VendorApplication[] } }
  ).data.getPendingVendorApplications;
}

export async function approveVendor(applicationId: string): Promise<Vendor> {
  const mutation = /* GraphQL */ `
    mutation ApproveVendor($applicationId: ID!) {
      approveVendor(applicationId: $applicationId) {
        id name address status whatsappNumber createdAt
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { applicationId },
    authMode: 'userPool',
  });
  return (result as { data: { approveVendor: Vendor } }).data.approveVendor;
}

export async function rejectVendor(
  applicationId: string,
  reason?: string
): Promise<VendorApplication> {
  const mutation = /* GraphQL */ `
    mutation RejectVendor($applicationId: ID!, $reason: String) {
      rejectVendor(applicationId: $applicationId, reason: $reason) {
        id status
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { applicationId, reason },
    authMode: 'userPool',
  });
  return (result as { data: { rejectVendor: VendorApplication } }).data.rejectVendor;
}

export async function getAllOrders(status?: OrderStatus): Promise<Order[]> {
  const query = /* GraphQL */ `
    query GetAllOrders($status: OrderStatus) {
      getAllOrders(status: $status) {
        id orderNumber paymentRef customerId vendorId status deliveryMethod totalAmount
        paymentMethod paymentStatus contactPhone createdAt
        guestDetails { name phone }
      }
    }
  `;
  const result = await client().graphql({ query, variables: { status }, authMode: 'userPool' });
  return (result as { data: { getAllOrders: Order[] } }).data.getAllOrders;
}

// ── Reviews ───────────────────────────────────────

export async function getVendorReviews(vendorId: string): Promise<Review[]> {
  const query = /* GraphQL */ `
    query GetVendorReviews($vendorId: ID!) {
      getVendorReviews(vendorId: $vendorId) {
        id vendorId userId guestName rating comment createdAt
      }
    }
  `;
  const result = await client().graphql({ query, variables: { vendorId } });
  return (result as { data: { getVendorReviews: Review[] } }).data.getVendorReviews;
}

// ── Mark Order Paid ───────────────────────────────

export async function markOrderPaid(orderId: string): Promise<Order> {
  const mutation = /* GraphQL */ `
    mutation MarkOrderPaid($orderId: ID!) {
      markOrderPaid(orderId: $orderId) {
        id orderNumber paymentRef status paymentStatus updatedAt
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { orderId },
    authMode: 'userPool',
  });
  return (result as { data: { markOrderPaid: Order } }).data.markOrderPaid;
}

// ── Vendor Profile Update ─────────────────────────

export interface UpdateVendorProfileInput {
  vendorId: string;
  name?: string;
  address?: string;
  location?: { lat: number; lng: number };
  contactDetails?: string;
  whatsappNumber?: string;
  deliveryType?: 'PERCENTAGE' | 'FLAT';
  deliveryValue?: number;
  hasBankAccount?: boolean;
  digitalPaymentsEnabled?: boolean;
  description?: string;
  imageUrl?: string;
}

export async function updateVendorProfile(input: UpdateVendorProfileInput): Promise<Vendor> {
  const mutation = /* GraphQL */ `
    mutation UpdateVendorProfile($input: UpdateVendorProfileInput!) {
      updateVendorProfile(input: $input) {
        id ownerId name address contactDetails status
        deliveryType deliveryValue hasBankAccount digitalPaymentsEnabled whatsappNumber
        imageUrl description createdAt
        location { lat lng }
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { input },
    authMode: 'userPool',
  });
  return (result as { data: { updateVendorProfile: Vendor } }).data.updateVendorProfile;
}

export async function updateVendorBankDetails(
  vendorId: string,
  bankDetails: BankDetails
): Promise<Vendor> {
  const mutation = /* GraphQL */ `
    mutation UpdateVendorBankDetails($vendorId: ID!, $bankDetails: BankDetailsInput!) {
      updateVendorBankDetails(vendorId: $vendorId, bankDetails: $bankDetails) {
        id ownerId name address contactDetails status
        deliveryType deliveryValue hasBankAccount whatsappNumber
        imageUrl description createdAt
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { vendorId, bankDetails },
    authMode: 'userPool',
  });
  return (result as { data: { updateVendorBankDetails: Vendor } }).data.updateVendorBankDetails;
}

export async function getVendorBankDetails(vendorId: string): Promise<BankDetails | null> {
  const query = /* GraphQL */ `
    query GetVendorBankDetails($vendorId: ID!) {
      getVendorBankDetails(vendorId: $vendorId) {
        bankName accountNumber accountHolder branchCode
      }
    }
  `;
  const result = await client().graphql({ query, variables: { vendorId }, authMode: 'userPool' });
  return (result as { data: { getVendorBankDetails: BankDetails | null } }).data
    .getVendorBankDetails;
}

// ── Payments ───────────────────────────────────────

export interface PaymentInitiation {
  provider: 'PAYFAST' | 'OZOW';
  redirectUrl: string;
  paymentRef: string;
}

export async function initiatePayment(
  orderId: string,
  provider: 'PAYFAST' | 'OZOW'
): Promise<PaymentInitiation> {
  const mutation = /* GraphQL */ `
    mutation InitiatePayment($orderId: ID!, $provider: PaymentProvider!) {
      initiatePayment(orderId: $orderId, provider: $provider) {
        provider redirectUrl paymentRef
      }
    }
  `;
  const result = await client().graphql({
    query: mutation,
    variables: { orderId, provider },
  });
  return (result as { data: { initiatePayment: PaymentInitiation } }).data.initiatePayment;
}

// ── AppSync Subscriptions ─────────────────────────
//
// Usage:
//   const subscription = subscribeToNewOrders(vendorId, (order) => { ... });
//   // cleanup:
//   subscription.unsubscribe();

/** GraphQL subscription document for new orders on a vendor. */
export const ON_NEW_ORDER_FOR_VENDOR = /* GraphQL */ `
  subscription OnNewOrderForVendor($vendorId: ID!) {
    onNewOrderForVendor(vendorId: $vendorId) {
      id orderNumber paymentRef customerId vendorId status deliveryMethod deliveryFee
      subtotal totalAmount paymentMethod paymentStatus contactPhone
      createdAt updatedAt
      guestDetails { name phone }
      items { id menuItemId name price quantity }
    }
  }
`;

/** GraphQL subscription document for order status updates. */
export const ON_ORDER_STATUS_UPDATED = /* GraphQL */ `
  subscription OnOrderStatusUpdated($orderId: ID!) {
    onOrderStatusUpdated(orderId: $orderId) {
      id status paymentStatus updatedAt
    }
  }
`;

/**
 * Subscribe to new orders for a vendor.
 * Returns a subscription handle with an `unsubscribe()` method.
 */
export function subscribeToNewOrders(
  vendorId: string,
  onNext: (order: Order) => void,
  onError?: (err: unknown) => void
): { unsubscribe: () => void } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (client().graphql({
    query: ON_NEW_ORDER_FOR_VENDOR,
    variables: { vendorId },
    authMode: 'userPool',
  }) as any).subscribe({
    next: ({ data }: { data: { onNewOrderForVendor: Order } }) => {
      if (data?.onNewOrderForVendor) onNext(data.onNewOrderForVendor);
    },
    error: (err: unknown) => {
      console.warn('[subscribeToNewOrders] error:', err);
      if (onError) onError(err);
    },
  });
  return sub;
}

/**
 * Subscribe to status updates for a specific order.
 * Returns a subscription handle with an `unsubscribe()` method.
 */
export function subscribeToOrderStatus(
  orderId: string,
  onNext: (order: Partial<Order>) => void,
  onError?: (err: unknown) => void
): { unsubscribe: () => void } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (client().graphql({
    query: ON_ORDER_STATUS_UPDATED,
    variables: { orderId },
  }) as any).subscribe({
    next: ({ data }: { data: { onOrderStatusUpdated: Partial<Order> } }) => {
      if (data?.onOrderStatusUpdated) onNext(data.onOrderStatusUpdated);
    },
    error: (err: unknown) => {
      console.warn('[subscribeToOrderStatus] error:', err);
      if (onError) onError(err);
    },
  });
  return sub;
}

