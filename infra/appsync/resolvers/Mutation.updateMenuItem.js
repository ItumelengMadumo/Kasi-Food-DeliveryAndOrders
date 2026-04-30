// AppSync JS Resolver — Mutation.updateMenuItem
// Updates a vendor menu item in DynamoDB

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const { menuItemId, vendorId } = input;

  const updates = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description || null;
  if (input.price !== undefined) updates.price = input.price;
  if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl || null;
  if (input.category !== undefined) updates.category = input.category || null;
  if (input.available !== undefined) updates.available = input.available;

  if (Object.keys(updates).length === 0) {
    util.error('No menu item fields were provided to update.', 'BadRequest');
  }

  updates.updatedAt = util.time.nowISO8601();

  const expressionNames = {};
  const expressionValues = {};
  const setters = [];

  for (const [key, value] of Object.entries(updates)) {
    const nameKey = `#${key}`;
    const valueKey = `:${key}`;
    expressionNames[nameKey] = key;
    expressionValues[valueKey] = value;
    setters.push(`${nameKey} = ${valueKey}`);
  }

  return {
    operation: 'UpdateItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
      SK: util.dynamodb.toDynamoDB(`MENU#${menuItemId}`),
    },
    update: {
      expression: `SET ${setters.join(', ')}`,
      expressionNames,
      expressionValues: util.dynamodb.toMapValues(expressionValues),
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