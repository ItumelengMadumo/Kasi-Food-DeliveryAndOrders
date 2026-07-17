// AppSync JS Resolver — Mutation.deleteMenuItem
// Deletes a vendor menu item from DynamoDB

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { menuItemId, vendorId } = ctx.args;

  const groups = (ctx.identity && ctx.identity.groups) || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && (!ctx.identity || ctx.identity.sub !== vendorId)) {
    util.unauthorized();
  }

  return {
    operation: 'DeleteItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
      SK: util.dynamodb.toDynamoDB(`MENU#${menuItemId}`),
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return true;
}