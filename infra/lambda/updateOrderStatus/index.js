'use strict';

/**
 * updateOrderStatus Lambda Function
 *
 * Updates order status and triggers notifications (SNS/SES).
 * Valid status transitions:
 *   PENDING → ACCEPTED | CANCELLED
 *   ACCEPTED → PREPARING | CANCELLED
 *   PREPARING → READY
 *   READY → OUT_FOR_DELIVERY | COMPLETED (for pickup)
 *   OUT_FOR_DELIVERY → COMPLETED
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

const VALID_TRANSITIONS = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED'],
  OUT_FOR_DELIVERY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

exports.handler = async (event) => {
  console.log('updateOrderStatus event:', JSON.stringify(event, null, 2));

  const { orderId, status } = event.arguments?.input || event.arguments || event;

  if (!orderId) throw new Error('orderId is required');
  if (!status) throw new Error('status is required');

  // Fetch current order
  const orderResult = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
    })
  );

  if (!orderResult.Item) {
    throw new Error(`Order ${orderId} not found`);
  }

  const order = orderResult.Item;
  const currentStatus = order.status;

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedTransitions.includes(status)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${status}. Allowed: ${allowedTransitions.join(', ')}`
    );
  }

  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
      UpdateExpression: 'SET #s = :s, updatedAt = :ua',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s': status,
        ':ua': now,
      },
    })
  );

  console.log(`Order ${orderId}: ${currentStatus} → ${status}`);

  return {
    ...order,
    id: orderId,
    status,
    updatedAt: now,
  };
};
