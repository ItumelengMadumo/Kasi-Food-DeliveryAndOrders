// AppSync JS Resolver — Order.vendor
// Field resolver — fetches the vendor profile for an order.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const vendorId = ctx.source.vendorId;
  if (!vendorId) return { operation: 'GetItem', key: util.dynamodb.toMapValues({ PK: '__none__', SK: '__none__' }) };
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      PK: `VENDOR#${vendorId}`,
      SK: 'PROFILE',
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  if (!item) return null;
  return {
    id: item.vendorId || item.PK.replace('VENDOR#', ''),
    ownerId: item.ownerId,
    name: item.name,
    address: item.address,
    contactDetails: item.contactDetails,
    status: item.status,
    deliveryType: item.deliveryType,
    deliveryValue: item.deliveryValue,
    hasBankAccount: item.hasBankAccount === true,
    whatsappNumber: item.whatsappNumber,
    refPrefix: item.refPrefix,
    imageUrl: item.imageUrl,
    description: item.description,
    rating: item.rating,
    totalReviews: item.totalReviews,
    createdAt: item.createdAt,
  };
}
