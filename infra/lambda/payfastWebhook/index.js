'use strict';

/**
 * payfastWebhook Lambda — handles PayFast's ITN (Instant Transaction
 * Notification) POST, behind API Gateway HTTP API route POST /webhooks/payfast/itn.
 *
 * Steps (per PayFast's integration guide):
 *   1. Recompute the MD5 signature over the posted fields (in POST order) and
 *      compare to the `signature` field.
 *   2. Re-validate server-to-server against PayFast's /eng/query/validate
 *      endpoint (defends against a spoofed direct POST to this URL).
 *   3. Confirm the amount matches the order's totalAmount.
 *   4. Idempotently mark the order PAID and advance PENDING -> ACCEPTED.
 *
 * Always returns 200 once the payload has been parsed — PayFast retries
 * non-200 responses for days, and retrying an invalid-signature payload is
 * pointless, so failures are logged and swallowed rather than surfaced.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { getPaymentSecrets } = require('../_shared/secrets');
const { verifyItnSignature, hostForMode } = require('../_shared/payfast');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
  const params = new URLSearchParams(raw);
  const ordered = [...params.entries()];
  const fields = Object.fromEntries(ordered);
  return { ordered, fields };
}

async function validateWithPayFast(mode, rawBody) {
  try {
    const res = await fetch(`https://${hostForMode(mode)}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    });
    const text = await res.text();
    return text.trim() === 'VALID';
  } catch (err) {
    console.warn('PayFast server-to-server validation request failed:', err.message);
    return false;
  }
}

exports.handler = async (event) => {
  console.log('payfastWebhook event:', JSON.stringify({ headers: event.headers }));

  const { ordered, fields } = parseBody(event);
  const secrets = await getPaymentSecrets();
  const mode = secrets.payfastMode || 'sandbox';

  const signatureOk = verifyItnSignature(ordered, secrets.payfastPassphrase || '', fields.signature);
  if (!signatureOk) {
    console.warn('PayFast ITN signature mismatch — ignoring payload', { orderId: fields.m_payment_id });
    return { statusCode: 200, body: 'ignored' };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
  const serverValidated = await validateWithPayFast(mode, rawBody);
  if (!serverValidated) {
    console.warn('PayFast server-to-server validation failed — ignoring payload', {
      orderId: fields.m_payment_id,
    });
    return { statusCode: 200, body: 'ignored' };
  }

  const orderId = fields.m_payment_id;
  if (!orderId) {
    console.warn('PayFast ITN missing m_payment_id');
    return { statusCode: 200, body: 'ignored' };
  }

  const orderResult = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' } })
  );
  const order = orderResult.Item;
  if (!order) {
    console.warn('PayFast ITN references unknown order', { orderId });
    return { statusCode: 200, body: 'ignored' };
  }

  const paidAmount = parseFloat(fields.amount_gross || fields.amount || '0');
  if (Math.abs(paidAmount - order.totalAmount) > 0.01) {
    console.warn('PayFast ITN amount mismatch', { orderId, paidAmount, expected: order.totalAmount });
    return { statusCode: 200, body: 'ignored' };
  }

  if (order.paymentStatus === 'PAID') {
    return { statusCode: 200, body: 'already processed' };
  }

  if (fields.payment_status !== 'COMPLETE') {
    console.log('PayFast ITN non-complete status', { orderId, status: fields.payment_status });
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

  console.log(`Order ${orderId} marked PAID via PayFast ITN`);
  return { statusCode: 200, body: 'ok' };
};
