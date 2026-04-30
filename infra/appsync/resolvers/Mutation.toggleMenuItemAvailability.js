// AppSync JS Resolver — Mutation.toggleMenuItemAvailability
// Updates the available flag for a vendor menu item in DynamoDB

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { menuItemId, vendorId, available } = ctx.args;

  return {
    operation: 'UpdateItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
      SK: util.dynamodb.toDynamoDB(`MENU#${menuItemId}`),
    },
    update: {
      expression: 'SET #available = :available, #updatedAt = :updatedAt',
      expressionNames: {
        '#available': 'available',
        '#updatedAt': 'updatedAt',
      },
      expressionValues: util.dynamodb.toMapValues({
        ':available': available,
        ':updatedAt': util.time.nowISO8601(),
      }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.SK.replace('MENU#', ''),
    vendorId: item.PK.replace('VENDOR#', ''),
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    available: item.available,
    category: item.category,
    createdAt: item.createdAt,
  };
}