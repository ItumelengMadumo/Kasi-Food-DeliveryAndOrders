// AppSync JS Resolver — Query.getSpotRequests

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { status } = ctx.args;
  if (status) {
    return {
      operation: 'Scan',
      filter: {
        expression: 'begins_with(PK, :pk) AND #status = :status',
        expressionNames: { '#status': 'status' },
        expressionValues: {
          ':pk': util.dynamodb.toDynamoDB('SPOTREQUEST#'),
          ':status': util.dynamodb.toDynamoDB(status),
        },
      },
    };
  }
  return {
    operation: 'Scan',
    filter: {
      expression: 'begins_with(PK, :pk)',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB('SPOTREQUEST#'),
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return (ctx.result.items || []).map((item) => ({
    id: item.spotRequestId || item.PK.replace('SPOTREQUEST#', ''),
    name: item.name,
    location: item.location,
    areaText: item.areaText,
    category: item.category,
    ownerPhone: item.ownerPhone,
    requesterPhone: item.requesterPhone,
    status: item.status,
    createdAt: item.createdAt,
  }));
}
