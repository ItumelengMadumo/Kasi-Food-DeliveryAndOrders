// AppSync JS Resolver — Query.getVendor
// Fetches a single vendor by ID from DynamoDB

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId } = ctx.args;
  return {
    operation: 'GetItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
      SK: util.dynamodb.toDynamoDB('PROFILE'),
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  if (!ctx.result) return null;

  const item = ctx.result;
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
    imageUrl: item.imageUrl,
    description: item.description,
    rating: item.rating,
    totalReviews: item.totalReviews,
    createdAt: item.createdAt,
  };
}
