'use strict';

/**
 * sendWhatsAppNotification Lambda Function
 *
 * Sends a WhatsApp alert to the vendor's configured WhatsApp number
 * when a new order is created.
 *
 * Expected event payload:
 * {
 *   vendorId: string,
 *   orderId: string,
 *   orderItems: [{ name: string, quantity: number, price: number }],
 *   totalAmount: number,
 *   customerName: string | null
 * }
 *
 * Environment variables:
 *   TABLE_NAME             — DynamoDB table name
 *   TWILIO_ACCOUNT_SID     — Twilio Account SID
 *   TWILIO_AUTH_TOKEN      — Twilio Auth Token
 *   TWILIO_WHATSAPP_FROM   — Twilio WhatsApp sender number (e.g. +14155238886)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '';

/**
 * Send a WhatsApp message via Twilio REST API.
 * Uses the built-in `https` module to avoid external dependencies.
 */
function sendTwilioMessage(to, body) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.log(
      '[sendWhatsAppNotification] Twilio not configured — skipping send. Would send to',
      to,
      ':',
      body
    );
    return Promise.resolve({ success: false, reason: 'not_configured' });
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const postData = new URLSearchParams({
    From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
    To: `whatsapp:${to}`,
    Body: body,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, sid: parsed.sid });
            } else {
              console.warn('[sendWhatsAppNotification] Twilio error:', parsed.message);
              resolve({ success: false, error: parsed.message });
            }
          } catch {
            resolve({ success: false, error: 'Failed to parse Twilio response' });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Format order items list for the notification message.
 */
function formatOrderItems(orderItems) {
  if (!orderItems || orderItems.length === 0) return '(no items)';
  return orderItems.map((item) => `${item.name} x${item.quantity}`).join('\n');
}

exports.handler = async (event) => {
  console.log('sendWhatsAppNotification event:', JSON.stringify(event, null, 2));

  const { vendorId, orderId, orderItems = [], totalAmount, customerName } = event;

  if (!vendorId) throw new Error('vendorId is required');
  if (!orderId) throw new Error('orderId is required');

  // Fetch vendor record to get whatsappNumber
  const vendorResult = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `VENDOR#${vendorId}`, SK: 'PROFILE' },
    })
  );

  if (!vendorResult.Item) {
    console.warn(
      `[sendWhatsAppNotification] Vendor ${vendorId} not found — skipping notification`
    );
    return { success: false, reason: 'vendor_not_found' };
  }

  const vendor = vendorResult.Item;
  const vendorWhatsApp = vendor.whatsappNumber;

  if (!vendorWhatsApp) {
    console.warn(
      `[sendWhatsAppNotification] Vendor ${vendorId} has no whatsappNumber — skipping notification`
    );
    return { success: false, reason: 'no_whatsapp_number' };
  }

  const shortId = orderId.slice(-6).toUpperCase();
  const itemsList = formatOrderItems(orderItems);
  const total = parseFloat(totalAmount || 0).toFixed(2);
  const customer = customerName ? `\nCustomer: ${customerName}` : '';

  const message =
    `🚨 *New Order!*\n` +
    `\nOrder #${shortId}${customer}` +
    `\n\n${itemsList}` +
    `\n\n*Total: R${total}*` +
    `\n\nOpen your dashboard to process this order. 👇`;

  const result = await sendTwilioMessage(vendorWhatsApp, message);
  console.log('[sendWhatsAppNotification] Result:', result);

  return result;
};
