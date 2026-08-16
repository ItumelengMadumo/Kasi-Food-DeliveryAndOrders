// AppSync JS Resolver — Mutation.updatePaymentProofStatus
// Lets a vendor (or admin) move a WhatsApp EFT proof between
// PENDING_REVIEW / VERIFIED / FLAGGED. Replaces the localStorage-only
// status toggle that used to live entirely in the frontend.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { orderId, proofId, status } = ctx.args;

  const groups = (ctx.identity && ctx.identity.groups) || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && !(ctx.identity && ctx.identity.sub)) {
    util.unauthorized();
  }

  const expressionValues = {
    ':status': util.dynamodb.toDynamoDB(status),
    ':updatedAt': util.dynamodb.toDynamoDB(util.time.nowISO8601()),
  };

  // Non-admins may only update proofs belonging to their own vendor.
  let conditionExpression = 'attribute_exists(PK)';
  if (!isAdmin) {
    conditionExpression += ' AND vendorId = :ownerId';
    expressionValues[':ownerId'] = util.dynamodb.toDynamoDB(ctx.identity.sub);
  }

  return {
    operation: 'UpdateItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`ORDER#${orderId}`),
      SK: util.dynamodb.toDynamoDB(`POP#${proofId}`),
    },
    update: {
      expression: 'SET #status = :status, updatedAt = :updatedAt',
      expressionNames: { '#status': 'status' },
      expressionValues,
    },
    condition: {
      expression: conditionExpression,
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.unauthorized();
    }
    util.error(ctx.error.message, ctx.error.type);
  }

  const item = ctx.result;
  return {
    id: item.paymentProofId || item.SK.replace('POP#', ''),
    orderId: item.orderId,
    vendorId: item.vendorId,
    senderPhone: item.senderPhone,
    senderName: item.senderName,
    amount: item.amount,
    reference: item.reference,
    note: item.note,
    attachmentName: item.attachmentName,
    channel: item.channel,
    status: item.status,
    receivedAt: item.receivedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
