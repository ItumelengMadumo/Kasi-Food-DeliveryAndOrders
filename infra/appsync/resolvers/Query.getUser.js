// AppSync JS Resolver — Query.getUser

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { userId } = ctx.args;
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  if (!item) return null;
  return {
    id: item.userId || item.PK.replace('USER#', ''),
    name: item.name,
    phone: item.phone,
    email: item.email,
    role: item.role,
    isGuest: item.isGuest === true,
    createdAt: item.createdAt,
  };
}
