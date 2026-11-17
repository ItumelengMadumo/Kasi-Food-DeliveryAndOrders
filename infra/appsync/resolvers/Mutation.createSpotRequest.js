// AppSync JS Resolver — Mutation.createSpotRequest

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const spotRequestId = util.autoId();
  const now = util.time.nowISO8601();
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      PK: `SPOTREQUEST#${spotRequestId}`,
      SK: 'PROFILE',
    }),
    attributeValues: util.dynamodb.toMapValues({
      spotRequestId,
      name: input.name,
      location: input.location || null,
      areaText: input.areaText || null,
      category: input.category || null,
      ownerPhone: input.ownerPhone || null,
      requesterPhone: input.requesterPhone,
      status: 'NEW',
      createdAt: now,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.spotRequestId,
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
