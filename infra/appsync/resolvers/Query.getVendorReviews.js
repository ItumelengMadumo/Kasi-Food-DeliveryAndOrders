// AppSync JS Resolver — Query.getVendorReviews

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId } = ctx.args;
  return {
    operation: 'Query',
    query: {
      expression: 'PK = :pk AND begins_with(SK, :sk)',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`VENDOR#${vendorId}`),
        ':sk': util.dynamodb.toDynamoDB('REVIEW#'),
      },
    },
    scanIndexForward: false,
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || []).map((item) => ({
    id: item.SK.replace('REVIEW#', ''),
    vendorId: item.PK.replace('VENDOR#', ''),
    userId: item.userId,
    guestName: item.guestName,
    rating: item.rating,
    comment: item.comment,
    createdAt: item.createdAt,
  }));
}
