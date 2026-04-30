'use strict';

/**
 * approveVendor Lambda Function
 *
 * Called by AppSync mutation: approveVendor(applicationId: ID!): Vendor!
 *
 * Steps:
 *  1. Fetch the VendorApplication record.
 *  2. Create a new Vendor record (with whatsappNumber if provided).
 *  3. Update the application status to APPROVED in a DynamoDB transaction.
 *
 * Returns the newly created Vendor object.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const { derivePrefix } = require('../_shared/orderNumber');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';
const PREFIX_MAX_ATTEMPTS = 36; // base prefix + 35 numeric suffixes

/**
 * Resolve a unique vendor refPrefix by reserving PREFIX#<value> rows.
 * If the derived prefix is already taken, append digits 1..9 then letters A..Z.
 * Returns the reserved prefix; the reservation Put is appended to `transactItems`
 * so the whole approval is atomic.
 */
async function reserveUniquePrefix(businessName, vendorId, now) {
  const base = derivePrefix(businessName);
  const candidates = [base];
  // Suffixes: replace last char with 0-9 then A-Z, giving us 36 attempts total.
  const suffixChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const ch of suffixChars) {
    candidates.push(base.slice(0, 3) + ch);
  }

  for (let i = 0; i < Math.min(candidates.length, PREFIX_MAX_ATTEMPTS); i++) {
    const candidate = candidates[i];
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE_NAME,
                Item: {
                  PK: `PREFIX#${candidate}`,
                  SK: 'RESERVATION',
                  vendorId,
                  createdAt: now,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
          ],
        })
      );
      return candidate;
    } catch (err) {
      // ConditionalCheckFailed → try the next candidate
      if (err.name !== 'TransactionCanceledException' && err.name !== 'ConditionalCheckFailedException') {
        throw err;
      }
    }
  }
  throw new Error(`Unable to reserve a unique refPrefix for ${businessName}`);
}

exports.handler = async (event) => {
  console.log('approveVendor event:', JSON.stringify(event, null, 2));

  const applicationId =
    event.arguments?.applicationId || event.applicationId;

  if (!applicationId) {
    throw new Error('applicationId is required');
  }

  // 1. Fetch the application
  const appResult = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `APPLICATION#${applicationId}`, SK: 'PROFILE' },
    })
  );

  if (!appResult.Item) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const app = appResult.Item;

  if (app.status === 'APPROVED') {
    throw new Error(`Application ${applicationId} is already approved`);
  }

  if (app.status === 'REJECTED') {
    throw new Error(`Application ${applicationId} has been rejected and cannot be approved`);
  }

  // 2. Generate a new Vendor ID
  const vendorId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Reserve a unique refPrefix for this vendor (used to build orderNumbers + payment refs).
  const refPrefix = await reserveUniquePrefix(app.businessName, vendorId, now);

  // Build the vendor item — include GSI3PK if a WhatsApp number is provided
  const vendorItem = {
    PK: `VENDOR#${vendorId}`,
    SK: 'PROFILE',
    vendorId,
    ownerId: app.ownerId || applicationId, // fall back to applicationId if no ownerId
    name: app.businessName,
    address: app.address,
    contactDetails: app.phone,
    status: 'APPROVED',
    deliveryType: null,
    deliveryValue: null,
    hasBankAccount: app.hasBankAccount || false,
    refPrefix,
    imageUrl: null,
    description: app.description || null,
    rating: null,
    totalReviews: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Conditionally set whatsappNumber + GSI3PK for the vendor-by-WhatsApp index
  if (app.whatsappNumber) {
    vendorItem.whatsappNumber = app.whatsappNumber;
    vendorItem.GSI3PK = app.whatsappNumber;
  }

  // 3. Write vendor + update application in a single transaction
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        // Create vendor record
        {
          Put: {
            TableName: TABLE_NAME,
            Item: vendorItem,
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        // Mark application as APPROVED
        {
          Update: {
            TableName: TABLE_NAME,
            Key: { PK: `APPLICATION#${applicationId}`, SK: 'PROFILE' },
            UpdateExpression: 'SET #st = :s, updatedAt = :ua',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
              ':s': 'APPROVED',
              ':ua': now,
              ':pending': 'PENDING',
            },
            // Only update if still PENDING (prevents concurrent double-approvals)
            ConditionExpression: '#st = :pending',
          },
        },
      ],
    })
  );

  console.log(`Application ${applicationId} approved — Vendor ${vendorId} created (refPrefix=${refPrefix})`);

  return {
    id: vendorId,
    ownerId: vendorItem.ownerId,
    name: vendorItem.name,
    address: vendorItem.address,
    contactDetails: vendorItem.contactDetails,
    status: 'APPROVED',
    hasBankAccount: vendorItem.hasBankAccount,
    whatsappNumber: vendorItem.whatsappNumber || null,
    refPrefix,
    deliveryType: null,
    deliveryValue: null,
    imageUrl: null,
    description: vendorItem.description,
    rating: null,
    totalReviews: 0,
    createdAt: now,
    updatedAt: now,
  };
};
