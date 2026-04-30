// AppSync JS Resolver — Query.getAllOrders (admin)
// Scan with optional status filter. Suitable for soft-launch volumes only.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const filter = {
    expression: 'SK = :sk',
    expressionValues: {
      ':sk': util.dynamodb.toDynamoDB('METADATA'),
    },
    expressionNames: {},
  };

  if (ctx.args.status) {
    filter.expression += ' AND #status = :status';
    filter.expressionNames['#status'] = 'status';
    filter.expressionValues[':status'] = util.dynamodb.toDynamoDB(ctx.args.status);
  }

  if (Object.keys(filter.expressionNames).length === 0) {
    delete filter.expressionNames;
  }

  return {
    operation: 'Scan',
    filter,
    limit: ctx.args.limit || 100,
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || [])
    .filter((item) => typeof item.PK === 'string' && item.PK.indexOf('ORDER#') === 0)
    .map((item) => ({
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
