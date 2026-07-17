// AppSync JS Resolver — Mutation.updateVendorBankDetails

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId, bankDetails } = ctx.args;

  const groups = (ctx.identity && ctx.identity.groups) || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && (!ctx.identity || ctx.identity.sub !== vendorId)) {
    util.unauthorized();
  }

  const parsed =
    typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails;
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `VENDOR#${vendorId}`,
      SK: 'PROFILE',
    }),
    update: {
      expression: 'SET bankDetails = :bd, hasBankAccount = :hba, updatedAt = :u',
      expressionValues: util.dynamodb.toMapValues({
        ':bd': parsed,
        ':hba': true,
        ':u': util.time.nowISO8601(),
      }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.vendorId || item.PK.replace('VENDOR#', ''),
    ownerId: item.ownerId,
    name: item.name,
    address: item.address,
    contactDetails: item.contactDetails,
    status: item.status,
    deliveryType: item.deliveryType,
    deliveryValue: item.deliveryValue,
    hasBankAccount: true,
    whatsappNumber: item.whatsappNumber,
    imageUrl: item.imageUrl,
    description: item.description,
    createdAt: item.createdAt,
  };
}
