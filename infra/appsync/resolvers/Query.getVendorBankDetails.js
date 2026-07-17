// AppSync JS Resolver — Query.getVendorBankDetails
// Owner vendor or admin only (enforced by @aws_cognito_user_pools directive
// in the schema plus the ownership check below). Never reachable via API key.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { vendorId } = ctx.args;

  const groups = (ctx.identity && ctx.identity.groups) || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && (!ctx.identity || ctx.identity.sub !== vendorId)) {
    util.unauthorized();
  }

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
  const item = ctx.result;
  if (!item || !item.bankDetails) return null;
  return {
    bankName: item.bankDetails.bankName || '',
    accountNumber: item.bankDetails.accountNumber || '',
    accountHolder: item.bankDetails.accountHolder || '',
    branchCode: item.bankDetails.branchCode || '',
  };
}
