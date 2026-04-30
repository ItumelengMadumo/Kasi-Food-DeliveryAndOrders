// AppSync JS Resolver — Mutation.createVendorApplication
// Soft-launch flow auto-approves on Cognito post-confirmation, but this remains
// available for "apply without account" web submissions reviewed by admins.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const applicationId = util.autoId();
  const now = util.time.nowISO8601();
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      PK: `APPLICATION#${applicationId}`,
      SK: 'PROFILE',
    }),
    attributeValues: util.dynamodb.toMapValues({
      applicationId,
      applicantName: input.applicantName,
      phone: input.phone,
      email: input.email || null,
      businessName: input.businessName,
      address: input.address,
      description: input.description || null,
      hasBankAccount: input.hasBankAccount === true,
      whatsappNumber: input.whatsappNumber || null,
      status: 'PENDING',
      createdAt: now,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.applicationId,
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
