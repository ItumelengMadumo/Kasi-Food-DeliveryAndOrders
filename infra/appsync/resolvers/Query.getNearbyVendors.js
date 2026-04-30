// AppSync JS Resolver — Query.getNearbyVendors
// Soft-launch: returns all APPROVED vendors. Add real geo filtering later
// (e.g. geohash GSI or PostGIS via Aurora) — for now we just degrade gracefully.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Scan',
    filter: {
      expression: 'SK = :sk AND #status = :status',
      expressionNames: { '#status': 'status' },
      expressionValues: {
        ':sk': util.dynamodb.toDynamoDB('PROFILE'),
        ':status': util.dynamodb.toDynamoDB('APPROVED'),
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || [])
    .filter((item) => typeof item.PK === 'string' && item.PK.indexOf('VENDOR#') === 0)
    .map((item) => ({
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
    }));
}
