// AppSync JS Resolver — Mutation.markOrderPaid
// Marks an order's paymentStatus as PAID.
// Used by vendors from the dashboard to record manual cash/EFT payments.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { orderId } = ctx.args;

  const groups = (ctx.identity && ctx.identity.groups) || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && !(ctx.identity && ctx.identity.sub)) {
    util.unauthorized();
  }

  const expressionValues = {
    ':ps': util.dynamodb.toDynamoDB('PAID'),
    ':ua': util.dynamodb.toDynamoDB(util.time.nowISO8601()),
  };

  // Non-admins may only mark paid the orders belonging to their own vendor.
  let conditionExpression = 'attribute_exists(PK)';
  if (!isAdmin) {
    conditionExpression += ' AND vendorId = :ownerId';
    expressionValues[':ownerId'] = util.dynamodb.toDynamoDB(ctx.identity.sub);
  }

  return {
    operation: 'UpdateItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`ORDER#${orderId}`),
      SK: util.dynamodb.toDynamoDB('METADATA'),
    },
    update: {
      expression: 'SET paymentStatus = :ps, updatedAt = :ua',
      expressionValues,
    },
    condition: {
      expression: conditionExpression,
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.unauthorized();
    }
    util.error(ctx.error.message, ctx.error.type);
  }

  const item = ctx.result;
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
