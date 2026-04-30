// AppSync JS Resolver — Mutation.createReview

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const reviewId = util.autoId();
  const now = util.time.nowISO8601();
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      PK: `VENDOR#${input.vendorId}`,
      SK: `REVIEW#${reviewId}`,
    }),
    attributeValues: util.dynamodb.toMapValues({
      reviewId,
      vendorId: input.vendorId,
      userId: input.userId || null,
      guestName: input.guestName || null,
      rating: input.rating,
      comment: input.comment || null,
      createdAt: now,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.SK.replace('REVIEW#', ''),
    vendorId: item.PK.replace('VENDOR#', ''),
    userId: item.userId,
    guestName: item.guestName,
    rating: item.rating,
    comment: item.comment,
    createdAt: item.createdAt,
  };
}
