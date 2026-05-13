// AppSync JS Resolver — Query.getVendorInventory
// Returns inventory records for a vendor, optionally filtered by status.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId, status } = ctx.args;

  const request = {
    operation: 'Query',
    query: {
      expression: 'PK = :pk AND begins_with(SK, :sk)',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
        ':sk': util.dynamodb.toDynamoDB('INV#'),
      },
    },
    scanIndexForward: false,
  };

  if (status) {
    request.filter = {
      expression: '#status = :status',
      expressionNames: {
        '#status': 'status',
      },
      expressionValues: {
        ':status': util.dynamodb.toDynamoDB(status),
      },
    };
  }

  return request;
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);

  return (ctx.result.items || []).map((item) => ({
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
  }));
}
