// AppSync JS Resolver — Query.getVendorOrders
// Uses GSI1 to query orders by vendor

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId, status } = ctx.args;

  const request = {
    operation: 'Query',
    index: 'GSI1-VendorOrders',
    query: {
      expression: 'GSI1PK = :pk',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
      },
    },
    scanIndexForward: false,
  };

  if (status) {
    request.filter = {
      expression: '#s = :s',
      expressionNames: { '#s': 'status' },
      expressionValues: { ':s': util.dynamodb.toDynamoDB(status) },
    };
  }

  return request;
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || []).map((item) => ({
    id: item.PK.replace('ORDER#', ''),
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
