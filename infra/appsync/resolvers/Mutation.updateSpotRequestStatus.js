// AppSync JS Resolver — Mutation.updateSpotRequestStatus

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { spotRequestId, status } = ctx.args;
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `SPOTREQUEST#${spotRequestId}`,
      SK: 'PROFILE',
    }),
    update: {
      expression: 'SET #s = :s, updatedAt = :u',
      expressionNames: { '#s': 'status' },
      expressionValues: util.dynamodb.toMapValues({
        ':s': status,
        ':u': util.time.nowISO8601(),
      }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.spotRequestId || item.PK.replace('SPOTREQUEST#', ''),
    name: item.name,
    location: item.location,
    areaText: item.areaText,
    category: item.category,
    ownerPhone: item.ownerPhone,
    requesterPhone: item.requesterPhone,
    status: item.status,
    createdAt: item.createdAt,
  };
}
