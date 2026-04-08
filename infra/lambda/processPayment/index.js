'use strict';

/**
 * processPayment Lambda Function
 *
 * Handles two payment flows:
 *   1. Vendor has bank account  → digital payment (PayFast / Ozow)
 *   2. Vendor has NO bank account → cash on delivery/pickup; records admin fee
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
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID || '';
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY || '';

exports.handler = async (event) => {
  console.log('processPayment event:', JSON.stringify(event, null, 2));

  const { orderId, paymentMethod } = event.arguments || event;

  if (!orderId) throw new Error('orderId is required');

  // Fetch order
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

  // Non-banked vendor: cash flow
  if (!order.hasBankAccount) {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
        UpdateExpression:
          'SET paymentStatus = :ps, paymentMethod = :pm, updatedAt = :ua',
        ExpressionAttributeValues: {
          ':ps': 'PENDING_CASH',
          ':pm': paymentMethod || order.paymentMethod,
          ':ua': now,
        },
      })
    );

    return {
      success: true,
      flow: 'CASH',
      message: 'Order placed. Payment will be collected on delivery/pickup.',
      adminFee: order.platformFee,
    };
  }

  // Banked vendor: digital payment via PayFast
  // In production, generate PayFast payment URL and return it
  const paymentData = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    amount: order.totalAmount.toFixed(2),
    item_name: `Kasi Food Order ${orderId}`,
    m_payment_id: orderId,
    email_address: order.guestDetails?.email || '',
    name_first: order.guestDetails?.name?.split(' ')[0] || '',
    name_last: order.guestDetails?.name?.split(' ').slice(1).join(' ') || '',
  };

  // TODO: Generate PayFast payment URL / redirect
  const paymentUrl = `https://www.payfast.co.za/eng/process?${new URLSearchParams(
    paymentData
  ).toString()}`;

  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
      UpdateExpression:
        'SET paymentStatus = :ps, paymentMethod = :pm, updatedAt = :ua',
      ExpressionAttributeValues: {
        ':ps': 'AWAITING_PAYMENT',
        ':pm': 'DIGITAL',
        ':ua': now,
      },
    })
  );

  return {
    success: true,
    flow: 'DIGITAL',
    paymentUrl,
    message: 'Redirect customer to payment URL',
  };
};
