// AppSync JS Resolver — Query.getPendingVendorApplications

import { util } from '@aws-appsync/utils';

export function request() {
  return {
    operation: 'Scan',
    filter: {
      expression: 'begins_with(PK, :pk) AND #status = :status',
      expressionNames: { '#status': 'status' },
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB('APPLICATION#'),
        ':status': util.dynamodb.toDynamoDB('PENDING'),
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || []).map((item) => ({
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
  }));
}
