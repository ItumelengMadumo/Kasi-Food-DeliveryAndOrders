// AppSync JS Resolver — Query.getOrderPaymentProofs
// Returns proof-of-payment records for a specific order.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { orderId } = ctx.args;

  return {
    operation: 'Query',
    query: {
      expression: 'PK = :pk AND begins_with(SK, :sk)',
      expressionValues: {
        ':pk': util.dynamodb.toDynamoDB(`ORDER#${orderId}`),
        ':sk': util.dynamodb.toDynamoDB('POP#'),
      },
    },
    scanIndexForward: false,
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);

  return (ctx.result.items || []).map((item) => ({
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
  }));
}
