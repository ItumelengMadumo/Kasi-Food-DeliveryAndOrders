'use strict';

/**
 * ozowWebhook Lambda — handles Ozow's Notify callback, behind API Gateway
 * HTTP API route POST /webhooks/ozow/notify.
 *
 * Ozow posts application/x-www-form-urlencoded fields including a HashCheck
 * computed the same way as the outbound request hash (see _shared/ozow.js),
 * but over: SiteCode, TransactionId, TransactionReference, Amount, Status.
 *
 * Always returns 200 once parsed — see payfastWebhook for the same rationale.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { getPaymentSecrets } = require('../_shared/secrets');
const { buildNotifyHash } = require('../_shared/ozow');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

function parseFields(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
  const contentType = (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

exports.handler = async (event) => {
  console.log('ozowWebhook event:', JSON.stringify({ headers: event.headers }));

  const fields = parseFields(event);
  const secrets = await getPaymentSecrets();

  if (!secrets.ozowPrivateKey) {
    console.warn('Ozow webhook received but Ozow is not configured — ignoring');
    return { statusCode: 200, body: 'ignored' };
  }

  const computedHash = buildNotifyHash(
    {
      siteCode: fields.SiteCode,
      transactionId: fields.TransactionId,
      transactionReference: fields.TransactionReference,
      amount: fields.Amount,
      status: fields.Status,
    },
    secrets.ozowPrivateKey
  );

  if (computedHash !== fields.Hash && computedHash !== fields.HashCheck) {
    console.warn('Ozow notify HashCheck mismatch — ignoring payload', {
      orderId: fields.TransactionReference,
    });
    return { statusCode: 200, body: 'ignored' };
  }

  const orderId = fields.TransactionReference;
  if (!orderId) {
    console.warn('Ozow notify missing TransactionReference');
    return { statusCode: 200, body: 'ignored' };
  }

  const orderResult = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' } })
  );
  const order = orderResult.Item;
  if (!order) {
    console.warn('Ozow notify references unknown order', { orderId });
    return { statusCode: 200, body: 'ignored' };
  }

  const paidAmount = parseFloat(fields.Amount || '0');
  if (Math.abs(paidAmount - order.totalAmount) > 0.01) {
    console.warn('Ozow notify amount mismatch', { orderId, paidAmount, expected: order.totalAmount });
    return { statusCode: 200, body: 'ignored' };
  }

  if (order.paymentStatus === 'PAID') {
    return { statusCode: 200, body: 'already processed' };
  }

  if (fields.Status !== 'Complete') {
    console.log('Ozow notify non-complete status', { orderId, status: fields.Status });
    return { statusCode: 200, body: 'noted' };
  }

  const now = new Date().toISOString();
  const nextStatus = order.status === 'PENDING' ? 'ACCEPTED' : order.status;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
      UpdateExpression: 'SET paymentStatus = :ps, #s = :status, updatedAt = :ua',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':ps': 'PAID',
        ':status': nextStatus,
        ':ua': now,
      },
    })
  );

  console.log(`Order ${orderId} marked PAID via Ozow notify`);
  return { statusCode: 200, body: 'ok' };
};
