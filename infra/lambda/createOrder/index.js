'use strict';

/**
 * createOrder Lambda Function
 *
 * Called by AppSync mutation: createOrder
 * Handles:
 *   - Guest vs registered user
 *   - Delivery fee calculation
 *   - Order creation in DynamoDB
 *   - Admin fee tracking for non-banked vendors
 *   - Async WhatsApp notification to the vendor
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { v4: uuidv4 } = require('uuid');
const {
  generateOrderNumber,
  derivePrefix,
} = require('../_shared/orderNumber');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const lambdaClient = new LambdaClient({});

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';
const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10'); // 10%
const ADMIN_FEE_NON_BANKED = parseFloat(process.env.ADMIN_FEE_NON_BANKED || '5.00'); // R5 per order
const NOTIFICATION_LAMBDA_ARN = process.env.NOTIFICATION_LAMBDA_ARN || '';

/**
 * Calculate delivery fee based on vendor settings.
 * @param {Object} vendor - Vendor record from DynamoDB
 * @param {number} subtotal - Order subtotal in Rands
 * @param {string} deliveryMethod - 'DELIVERY' or 'PICKUP'
 * @returns {number} delivery fee
 */
function calculateDeliveryFee(vendor, subtotal, deliveryMethod) {
  if (deliveryMethod === 'PICKUP') return 0;

  const { deliveryType, deliveryValue } = vendor;

  if (!deliveryType || deliveryValue == null) return 0;

  if (deliveryType === 'PERCENTAGE') {
    return parseFloat(((deliveryValue / 100) * subtotal).toFixed(2));
  }

  if (deliveryType === 'FLAT') {
    return parseFloat(deliveryValue.toFixed(2));
  }

  return 0;
}

exports.handler = async (event) => {
  console.log('createOrder event:', JSON.stringify(event, null, 2));

  const { input } = event.arguments;
  const {
    customerId,
    guestDetails,
    vendorId,
    deliveryMethod,
    paymentMethod,
    contactPhone,
    specialInstructions,
    items,
  } = input;

  // Validate: must have either customerId or guestDetails
  if (!customerId && (!guestDetails || !guestDetails.phone)) {
    throw new Error('Either customerId or guestDetails.phone must be provided');
  }

  if (!items || items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  // Fetch vendor
  const vendorResult = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `VENDOR#${vendorId}`, SK: 'PROFILE' },
    })
  );

  if (!vendorResult.Item) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  const vendor = vendorResult.Item;

  if (vendor.status !== 'APPROVED') {
    throw new Error('Vendor is not currently accepting orders');
  }

  // Calculate subtotal
  const subtotal = parseFloat(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  );

  // Calculate delivery fee
  const deliveryFee = calculateDeliveryFee(vendor, subtotal, deliveryMethod);

  // Calculate platform charges
  let platformFee = 0;
  if (vendor.hasBankAccount) {
    platformFee = parseFloat((subtotal * PLATFORM_COMMISSION_RATE).toFixed(2));
  } else {
    platformFee = ADMIN_FEE_NON_BANKED;
  }

  const totalAmount = parseFloat((subtotal + deliveryFee).toFixed(2));

  const orderId = uuidv4();
  const nowDate = new Date();
  const now = nowDate.toISOString();

  // Generate the human-facing orderNumber + bank-friendly paymentRef.
  // Falls back to a name-derived prefix for vendors approved before refPrefix existed.
  const prefix = vendor.refPrefix || derivePrefix(vendor.name);
  const { orderNumber, paymentRef } = await generateOrderNumber(
    ddb,
    TABLE_NAME,
    vendorId,
    prefix,
    nowDate
  );

  // Build DynamoDB transact items
  const transactItems = [];

  // Order metadata record
  const orderRecord = {
    PK: `ORDER#${orderId}`,
    SK: 'METADATA',
    GSI1PK: `VENDOR#${vendorId}`,
    GSI1SK: `ORDER#${now}`,
    orderId,
    orderNumber,
    paymentRef,
    customerId: customerId || null,
    guestDetails: guestDetails || null,
    vendorId,
    status: 'PENDING',
    deliveryMethod,
    deliveryFee,
    subtotal,
    totalAmount,
    platformFee,
    paymentMethod,
    contactPhone,
    specialInstructions: specialInstructions || null,
    hasBankAccount: vendor.hasBankAccount,
    source: 'WEB',
    createdAt: now,
    updatedAt: now,
  };

  // Add GSI2 for registered customers
  if (customerId) {
    orderRecord.GSI2PK = `USER#${customerId}`;
    orderRecord.GSI2SK = `ORDER#${now}`;
  }

  transactItems.push({
    Put: {
      TableName: TABLE_NAME,
      Item: orderRecord,
    },
  });

  // Order item records
  for (const item of items) {
    const itemId = uuidv4();
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `ORDER#${orderId}`,
          SK: `ITEM#${itemId}`,
          orderId,
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          createdAt: now,
        },
      },
    });
  }

  await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));

  console.log(`Order ${orderId} (${orderNumber}) created successfully`);

  // Fire-and-forget: notify the vendor via WhatsApp (does not block order response)
  if (NOTIFICATION_LAMBDA_ARN) {
    try {
      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: NOTIFICATION_LAMBDA_ARN,
          InvocationType: 'Event', // async, non-blocking
          Payload: JSON.stringify({
            vendorId,
            orderId,
            orderNumber,
            orderItems: items.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.price,
            })),
            totalAmount,
            customerName: guestDetails?.name || null,
          }),
        })
      );
    } catch (notifErr) {
      // Never fail the order because a notification could not be sent
      console.warn('Failed to invoke sendWhatsAppNotification:', notifErr.message);
    }
  }

  return {
    id: orderId,
    orderNumber,
    paymentRef,
    customerId: customerId || null,
    guestDetails: guestDetails || null,
    vendorId,
    status: 'PENDING',
    deliveryMethod,
    deliveryFee,
    subtotal,
    totalAmount,
    paymentMethod,
    contactPhone,
    specialInstructions: specialInstructions || null,
    source: 'WEB',
    createdAt: now,
    updatedAt: now,
  };
};
