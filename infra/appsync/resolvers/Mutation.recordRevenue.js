// AppSync JS Resolver — Mutation.recordRevenue
// Stores manual or system sales entries for reporting and mini-ERP workflows.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const entryId = util.autoId();
  const now = util.time.nowISO8601();
  const saleDate = input.saleDate || now;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      PK: `VENDOR#${input.vendorId}`,
      SK: `REV#${saleDate}#${entryId}`,
    }),
    attributeValues: util.dynamodb.toMapValues({
      revenueEntryId: entryId,
      vendorId: input.vendorId,
      orderId: input.orderId || null,
      source: input.source,
      grossAmount: input.grossAmount,
      netAmount: input.netAmount ?? null,
      paymentMethod: input.paymentMethod || null,
      note: input.note || null,
      saleDate,
      createdBy: input.createdBy || null,
      createdAt: now,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;

  return {
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
  };
}
