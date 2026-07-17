// AppSync JS Resolver — Mutation.createMenuItem
// Writes a new menu item to DynamoDB

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const { vendorId, name, description, price, imageUrl, category } = input;
  const available = input.available !== false;

  const groups = (ctx.identity && ctx.identity.groups) || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && (!ctx.identity || ctx.identity.sub !== vendorId)) {
    util.unauthorized();
  }

  const menuItemId = util.autoId();
  const now = util.time.nowISO8601();

  return {
    operation: 'PutItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
      SK: util.dynamodb.toDynamoDB(`MENU#${menuItemId}`),
    },
    attributeValues: util.dynamodb.toMapValues({
      menuItemId,
      vendorId,
      name,
      description: description || null,
      price,
      imageUrl: imageUrl || null,
      available,
      category: category || null,
      createdAt: now,
    }),
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
