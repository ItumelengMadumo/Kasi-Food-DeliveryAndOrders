// AppSync JS Resolver — Mutation.cancelOrder

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { orderId } = ctx.args;

  const groups = (ctx.identity && ctx.identity.groups) || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && !(ctx.identity && ctx.identity.sub)) {
    util.unauthorized();
  }

  const expressionValues = {
    ':s': 'CANCELLED',
    ':r': ctx.args.reason || null,
    ':u': util.time.nowISO8601(),
  };

  // Non-admins may only cancel orders belonging to their own vendor.
  let conditionExpression = 'attribute_exists(PK)';
  if (!isAdmin) {
    conditionExpression += ' AND vendorId = :ownerId';
    expressionValues[':ownerId'] = ctx.identity.sub;
  }

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `ORDER#${orderId}`,
      SK: 'METADATA',
    }),
    update: {
      expression: 'SET #s = :s, cancelReason = :r, updatedAt = :u',
      expressionNames: { '#s': 'status' },
      expressionValues: util.dynamodb.toMapValues(expressionValues),
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
    vendorId: item.vendorId,
    status: item.status,
    deliveryMethod: item.deliveryMethod,
    subtotal: item.subtotal,
    totalAmount: item.totalAmount,
    paymentMethod: item.paymentMethod,
    contactPhone: item.contactPhone,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
