'use strict';

/**
 * Cognito PostConfirmation trigger.
 *
 * Runs when a user finishes sign-up (email/phone verification). For VENDOR
 * sign-ups it auto-creates an APPROVED Vendor record so the user lands on a
 * functional dashboard immediately. For other roles it creates a USER profile
 * record only.
 *
 * Vendor identity rule: vendorId === Cognito sub. This is the canonical
 * identity used everywhere downstream.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { derivePrefix } = require('../_shared/orderNumber');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cog = new CognitoIdentityProviderClient({});

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

const VALID_ROLES = ['CUSTOMER', 'VENDOR', 'ADMIN'];

function pickRole(attrs) {
  const raw = (attrs['custom:role'] || '').toUpperCase();
  if (VALID_ROLES.indexOf(raw) >= 0) return raw;
  // Soft-launch default — the public sign-up flow is for vendors.
  return 'VENDOR';
}

exports.handler = async (event) => {
  console.log('postConfirmation event:', JSON.stringify(event, null, 2));

  // Skip for triggerSource === 'PostConfirmation_ConfirmForgotPassword' etc.
  if (event.triggerSource && event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const userPoolId = event.userPoolId;
  const username = event.userName;
  const sub = event.request.userAttributes.sub;
  const role = pickRole(event.request.userAttributes);
  const phone = event.request.userAttributes.phone_number || '';
  const email = event.request.userAttributes.email || null;
  const name = event.request.userAttributes.name || phone || email || username;
  const now = new Date().toISOString();

  // Always create a USER record.
  const userRecord = {
    PK: `USER#${sub}`,
    SK: 'PROFILE',
    userId: sub,
    name,
    phone,
    email,
    role,
    isGuest: false,
    createdAt: now,
  };

  if (role === 'VENDOR') {
    const vendorId = sub; // canonical: vendor.id === cognito sub
    const refPrefix = derivePrefix(name || 'KASI');

    const vendorRecord = {
      PK: `VENDOR#${vendorId}`,
      SK: 'PROFILE',
      vendorId,
      ownerId: sub,
      name: name || 'New Vendor',
      address: '',
      contactDetails: phone,
      status: 'APPROVED',
      hasBankAccount: false,
      refPrefix,
      whatsappNumber: phone || null,
      createdAt: now,
    };
    if (phone) vendorRecord.GSI3PK = phone;

    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: TABLE_NAME, Item: userRecord } },
            { Put: { TableName: TABLE_NAME, Item: vendorRecord } },
            {
              Put: {
                TableName: TABLE_NAME,
                Item: {
                  PK: `PREFIX#${refPrefix}`,
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
    } catch (err) {
      // If the prefix collides, retry once with a sub-suffixed prefix.
      console.warn('Initial vendor write failed, retrying with unique prefix:', err.message);
      const fallbackPrefix = (refPrefix + sub.slice(0, 4)).toUpperCase().slice(0, 6);
      vendorRecord.refPrefix = fallbackPrefix;
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            { Put: { TableName: TABLE_NAME, Item: userRecord } },
            { Put: { TableName: TABLE_NAME, Item: vendorRecord } },
            {
              Put: {
                TableName: TABLE_NAME,
                Item: {
                  PK: `PREFIX#${fallbackPrefix}`,
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
    }

    // Add the user to the VENDOR Cognito group.
    try {
      await cog.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: 'VENDOR',
        })
      );
    } catch (err) {
      console.warn('Failed to add user to VENDOR group:', err.message);
    }
  } else {
    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: userRecord }));

    if (role === 'ADMIN') {
      try {
        await cog.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: 'ADMIN',
          })
        );
      } catch (err) {
        console.warn('Failed to add user to ADMIN group:', err.message);
      }
    }
  }

  return event;
};
