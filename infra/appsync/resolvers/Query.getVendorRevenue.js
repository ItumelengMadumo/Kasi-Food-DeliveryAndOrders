// AppSync JS Resolver — Query.getVendorRevenue
// Returns revenue entries for a vendor; optional date range filtering.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId, fromDate, toDate } = ctx.args;

  const request = {
    operation: 'Query',
    query: {
      expression: 'PK = :pk AND begins_with(SK, :sk)',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
        ':sk': util.dynamodb.toDynamoDB('REV#'),
      },
    },
    scanIndexForward: false,
  };

  if (fromDate || toDate) {
    const filters = [];
    const expressionValues = {};

    if (fromDate) {
      filters.push('#saleDate >= :fromDate');
      expressionValues[':fromDate'] = util.dynamodb.toDynamoDB(fromDate);
    }

    if (toDate) {
      filters.push('#saleDate <= :toDate');
      expressionValues[':toDate'] = util.dynamodb.toDynamoDB(toDate);
    }

    request.filter = {
      expression: filters.join(' AND '),
      expressionNames: {
        '#saleDate': 'saleDate',
      },
      expressionValues,
    };
  }

  return request;
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);

  return (ctx.result.items || []).map((item) => ({
    id: item.revenueEntryId || item.SK.split('#').slice(2).join('#'),
    vendorId: item.vendorId,
    orderId: item.orderId,
    source: item.source,
    grossAmount: item.grossAmount,
    netAmount: item.netAmount,
    paymentMethod: item.paymentMethod,
    note: item.note,
    saleDate: item.saleDate,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
  }));
}
