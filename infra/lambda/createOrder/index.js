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
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';
const PLATFORM_COMMISSION_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10'); // 10%
const ADMIN_FEE_NON_BANKED = parseFloat(process.env.ADMIN_FEE_NON_BANKED || '5.00'); // R5 per order

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
  const now = new Date().toISOString();

  // Build DynamoDB transact items
  const transactItems = [];

  // Order metadata record
  const orderRecord = {
    PK: `ORDER#${orderId}`,
    SK: 'METADATA',
    GSI1PK: `VENDOR#${vendorId}`,
    GSI1SK: `ORDER#${now}`,
    orderId,
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

  console.log(`Order ${orderId} created successfully`);

  return {
    id: orderId,
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
    createdAt: now,
    updatedAt: now,
  };
};
