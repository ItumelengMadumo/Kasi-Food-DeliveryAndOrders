// AppSync JS Resolver — Mutation.rejectVendor

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { applicationId, reason } = ctx.args;
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `APPLICATION#${applicationId}`,
      SK: 'PROFILE',
    }),
    update: {
      expression: 'SET #s = :s, rejectReason = :r, updatedAt = :u',
      expressionNames: { '#s': 'status' },
      expressionValues: util.dynamodb.toMapValues({
        ':s': 'REJECTED',
        ':r': reason || null,
        ':u': util.time.nowISO8601(),
      }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.applicationId || item.PK.replace('APPLICATION#', ''),
    applicantName: item.applicantName,
    phone: item.phone,
    email: item.email,
    businessName: item.businessName,
    address: item.address,
    description: item.description,
    hasBankAccount: item.hasBankAccount === true,
    whatsappNumber: item.whatsappNumber,
    status: item.status,
    createdAt: item.createdAt,
  };
}
