// AppSync JS Resolver — Query.getCustomerOrders
// Lists all orders for a registered customer via GSI2.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { customerId } = ctx.args;
  return {
    operation: 'Query',
    index: 'GSI2-CustomerOrders',
    query: {
      expression: 'GSI2PK = :pk',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`USER#${customerId}`),
      },
    },
    scanIndexForward: false, // newest first
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || []).map((item) => ({
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
  }));
}
