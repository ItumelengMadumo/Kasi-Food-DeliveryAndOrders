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

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

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

  console.log(`Application ${applicationId} approved — Vendor ${vendorId} created`);

  return {
    id: vendorId,
    ownerId: vendorItem.ownerId,
    name: vendorItem.name,
    address: vendorItem.address,
    contactDetails: vendorItem.contactDetails,
    status: 'APPROVED',
    hasBankAccount: vendorItem.hasBankAccount,
    whatsappNumber: vendorItem.whatsappNumber || null,
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
