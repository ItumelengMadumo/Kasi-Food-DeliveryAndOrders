// AppSync JS Resolver — Mutation.markOrderPaid
// Marks an order's paymentStatus as PAID.
// Used by vendors from the dashboard to record manual cash/EFT payments.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { orderId } = ctx.args;

  return {
    operation: 'UpdateItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`ORDER#${orderId}`),
      SK: util.dynamodb.toDynamoDB('METADATA'),
    },
    update: {
      expression: 'SET paymentStatus = :ps, updatedAt = :ua',
      expressionValues: {
        ':ps': util.dynamodb.toDynamoDB('PAID'),
        ':ua': util.dynamodb.toDynamoDB(util.time.nowISO8601()),
      },
    },
    condition: {
      // Ensure the order exists before updating
      expression: 'attribute_exists(PK)',
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);

  const item = ctx.result;
  return {
    id: item.orderId || item.PK.replace('ORDER#', ''),
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
