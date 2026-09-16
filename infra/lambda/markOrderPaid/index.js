'use strict';

/**
 * markOrderPaid Lambda Function
 *
 * Direct DDB JS resolvers can only do a single conditional UpdateItem, but
 * marking an order paid needs a check-then-update: for EFT/PAYMENT_LINK
 * orders, a vendor may only flip paymentStatus to PAID if a linked
 * PaymentProof (PK=ORDER#<id>, SK=POP#<proofId>) has already been reviewed
 * and set to VERIFIED — otherwise this is an unguarded self-certification
 * path for fabricated proof-of-payment. Cash orders (paid face-to-face on
 * handover) keep the original self-certify behavior since there's no
 * forgeable digital claim to gate.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

const PROOF_REQUIRED_METHODS = ['EFT', 'PAYMENT_LINK'];

exports.handler = async (event) => {
  const { orderId } = event.arguments || {};
  if (!orderId) throw new Error('orderId is required');

  const identity = event.identity || {};
  const groups = identity.groups || [];
  const isAdmin = groups.includes('ADMIN') || groups.includes('SUPER_ADMIN');
  if (!isAdmin && !identity.sub) {
    throw new Error('Not authorized');
  }

  const orderResult = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
    })
  );

  const order = orderResult.Item;
  if (!order) throw new Error(`Order ${orderId} not found`);

  if (!isAdmin && identity.sub !== order.vendorId) {
    throw new Error('Not authorized to mark this order paid');
  }

  if (PROOF_REQUIRED_METHODS.includes(order.paymentMethod)) {
    const proofsResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ORDER#${orderId}`,
          ':skPrefix': 'POP#',
        },
      })
    );
    const hasVerifiedProof = (proofsResult.Items || []).some(
      (proof) => proof.status === 'VERIFIED'
    );
    if (!hasVerifiedProof) {
      throw new Error(
        'This order needs a verified payment proof before it can be marked paid. Review it under EFT Proofs first.'
      );
    }
  }

  const now = new Date().toISOString();

  const updateResult = await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
      UpdateExpression: 'SET paymentStatus = :ps, updatedAt = :ua',
      ExpressionAttributeValues: {
        ':ps': 'PAID',
        ':ua': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  const item = updateResult.Attributes;

  return {
    id: item.orderId || orderId,
    orderNumber: item.orderNumber,
    paymentRef: item.paymentRef,
    customerId: item.customerId,
    guestDetails: item.guestDetails,
    vendorId: item.vendorId,
    status: item.status,
    deliveryMethod: item.deliveryMethod,
    deliveryFee: item.deliveryFee,
    subtotal: item.subtotal,
    totalAmount: item.totalAmount,
    paymentMethod: item.paymentMethod,
    paymentStatus: item.paymentStatus,
    contactPhone: item.contactPhone,
    specialInstructions: item.specialInstructions,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};
