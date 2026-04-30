// AppSync JS Resolver — Order.items
// Field resolver — looks up child ITEM# records for an order.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const orderId = ctx.source.id;
  return {
    operation: 'Query',
    query: {
      expression: 'PK = :pk AND begins_with(SK, :sk)',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`ORDER#${orderId}`),
        ':sk': util.dynamodb.toDynamoDB('ITEM#'),
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || []).map((item) => ({
    id: item.SK.replace('ITEM#', ''),
    orderId: item.PK.replace('ORDER#', ''),
    menuItemId: item.menuItemId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));
}
