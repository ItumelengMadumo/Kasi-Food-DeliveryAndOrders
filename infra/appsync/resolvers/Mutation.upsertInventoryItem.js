// AppSync JS Resolver — Mutation.upsertInventoryItem
// Creates or updates a vendor inventory record.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const inventoryItemId = input.inventoryItemId || util.autoId();
  const now = util.time.nowISO8601();

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      PK: `VENDOR#${input.vendorId}`,
      SK: `INV#${inventoryItemId}`,
    }),
    attributeValues: util.dynamodb.toMapValues({
      inventoryItemId,
      vendorId: input.vendorId,
      name: input.name,
      sku: input.sku || null,
      unit: input.unit || null,
      quantityOnHand: input.quantityOnHand,
      reorderLevel: input.reorderLevel ?? null,
      unitCost: input.unitCost ?? null,
      status: input.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;

  return {
    id: item.inventoryItemId || item.SK.replace('INV#', ''),
    vendorId: item.vendorId,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    quantityOnHand: item.quantityOnHand,
    reorderLevel: item.reorderLevel,
    unitCost: item.unitCost,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
