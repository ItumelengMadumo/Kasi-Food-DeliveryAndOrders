// AppSync JS Resolver — Mutation.saveWhatsAppPaymentProof
// Persists WhatsApp proof-of-payment records under the order partition.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const proofId = util.autoId();
  const now = util.time.nowISO8601();

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      PK: `ORDER#${input.orderId}`,
      SK: `POP#${proofId}`,
    }),
    attributeValues: util.dynamodb.toMapValues({
      paymentProofId: proofId,
      orderId: input.orderId,
      vendorId: input.vendorId,
      senderPhone: input.senderPhone,
      senderName: input.senderName || null,
      amount: input.amount ?? null,
      reference: input.reference || null,
      note: input.note || null,
      attachmentName: input.attachmentName,
      channel: 'WHATSAPP',
      status: input.status || 'PENDING_REVIEW',
      receivedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
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
