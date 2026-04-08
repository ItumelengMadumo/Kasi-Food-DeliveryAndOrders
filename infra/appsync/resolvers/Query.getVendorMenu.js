// AppSync JS Resolver — Query.getVendorMenu
// Fetches all menu items for a vendor using a Query on VENDOR#<id> / begins_with MENU#

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId } = ctx.args;
  return {
    operation: 'Query',
    query: {
      expression: 'PK = :pk AND begins_with(SK, :sk)',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
        ':sk': util.dynamodb.toDynamoDB('MENU#'),
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || []).map((item) => ({
    id: item.SK.replace('MENU#', ''),
    vendorId: item.PK.replace('VENDOR#', ''),
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    available: item.available,
    category: item.category,
    createdAt: item.createdAt,
  }));
}
