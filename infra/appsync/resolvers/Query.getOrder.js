// AppSync JS Resolver — Query.getOrder
// Fetches a single order by id (metadata only; items resolved via Order.items field).

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { orderId } = ctx.args;
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      PK: `ORDER#${orderId}`,
      SK: 'METADATA',
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  if (!item) return null;
  return {
    id: item.orderId || item.PK.replace('ORDER#', ''),
    orderNumber: item.orderNumber,
    paymentRef: item.paymentRef,
    customerId: item.customerId,
    guestDetails: item.guestDetails,
    vendorId: item.vendorId,
    status: item.status,
    deliveryMethod: item.deliveryMethod,
    deliveryFee: item.deliveryFee,
    subtotal: item.subtotal,
    totalAmount: item.totalAmount,
    paymentMethod: item.paymentMethod,
    paymentStatus: item.paymentStatus,
    contactPhone: item.contactPhone,
    specialInstructions: item.specialInstructions,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
