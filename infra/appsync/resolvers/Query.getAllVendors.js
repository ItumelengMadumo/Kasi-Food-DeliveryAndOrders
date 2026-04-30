// AppSync JS Resolver — Query.getAllVendors
// Scans the table for all vendor profile records.
// Acceptable for the soft-launch volume (single-digit vendors). Replace with a
// dedicated index (e.g. ENTITY = 'VENDOR') before scaling.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const filter = {
    expression: 'SK = :sk',
    expressionValues: {
      ':sk': util.dynamodb.toDynamoDB('PROFILE'),
    },
  };

  if (ctx.args.status) {
    filter.expression += ' AND #status = :status';
    filter.expressionValues[':status'] = util.dynamodb.toDynamoDB(ctx.args.status);
    filter.expressionNames = { '#status': 'status' };
  }

  return {
    operation: 'Scan',
    filter,
  };
}

function mapVendor(item) {
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

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || [])
    .filter((item) => typeof item.PK === 'string' && item.PK.indexOf('VENDOR#') === 0)
    .map(mapVendor);
}
