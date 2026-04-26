// AppSync JS Resolver — Query.getVendorByWhatsApp
// Finds a vendor by WhatsApp number using GSI3-VendorByWhatsApp.
// Returns null if no vendor is registered with that number.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { whatsappNumber } = ctx.args;

  return {
    operation: 'Query',
    index: 'GSI3-VendorByWhatsApp',
    query: {
      expression: 'GSI3PK = :wn',
      expressionValues: {
        ':wn': util.dynamodb.toDynamoDB(whatsappNumber),
      },
    },
    limit: 1,
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);

  const items = ctx.result.items || [];
  if (items.length === 0) return null;

  const item = items[0];
  return {
    id: item.vendorId || item.PK.replace('VENDOR#', ''),
    ownerId: item.ownerId,
    name: item.name,
    address: item.address,
    location: item.location,
    contactDetails: item.contactDetails,
    workingHours: item.workingHours,
    status: item.status,
    deliveryType: item.deliveryType,
    deliveryValue: item.deliveryValue,
    hasBankAccount: item.hasBankAccount,
    whatsappNumber: item.GSI3PK || item.whatsappNumber || null,
    imageUrl: item.imageUrl,
    description: item.description,
    rating: item.rating,
    totalReviews: item.totalReviews,
    createdAt: item.createdAt,
  };
}
