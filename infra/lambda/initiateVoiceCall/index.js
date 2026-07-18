'use strict';

/**
 * initiateVoiceCall Lambda
 *
 * Called by AppSync mutation: initiateVoiceCall(vendorId, customerPhone)
 *
 * Bridge-call pattern (same one Uber/Airbnb use for masked calling):
 *   1. Twilio calls the CUSTOMER's phone first.
 *   2. The moment they answer, inline TwiML tells Twilio to dial the
 *      VENDOR's real number, presenting our own Twilio Voice number as the
 *      caller ID instead of the customer's personal number.
 *   3. Twilio bridges the two legs — customer and vendor talk normally,
 *      neither one's real number is exposed to the other.
 *
 * No inbound webhook is needed for this flow: the TwiML is passed inline
 * via the `Twiml` parameter on the initial Calls API request, so Twilio
 * never needs to call back into our infrastructure to know what to do.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');
const { getWhatsAppSecrets } = require('../_shared/secrets');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[c]));
}

function createTwilioCall({ accountSid, authToken, to, from, twiml }) {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const postData = new URLSearchParams({ To: to, From: from, Twiml: twiml }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${accountSid}/Calls.json`,
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, sid: parsed.sid, status: parsed.status });
            } else {
              reject(new Error(parsed.message || `Twilio call failed (${res.statusCode})`));
            }
          } catch {
            reject(new Error('Failed to parse Twilio response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('initiateVoiceCall event:', JSON.stringify(event, null, 2));

  const { vendorId, customerPhone } = event.arguments || event;
  if (!vendorId) throw new Error('vendorId is required');
  if (!customerPhone || !/^\+\d{8,15}$/.test(customerPhone)) {
    throw new Error('customerPhone must be in international format, e.g. +27721234567');
  }

  const vendorResult = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `VENDOR#${vendorId}`, SK: 'PROFILE' } })
  );
  const vendor = vendorResult.Item;
  if (!vendor) throw new Error(`Vendor ${vendorId} not found`);
  if (!vendor.contactDetails) throw new Error('This vendor has no contact number on file');

  const secrets = await getWhatsAppSecrets();
  if (!secrets.accountSid || !secrets.authToken || !secrets.voiceNumber) {
    throw new Error('Calling is not set up yet for this platform — try WhatsApp or the number directly');
  }

  const twiml =
    `<Response><Dial callerId="${escapeXml(secrets.voiceNumber)}">` +
    `<Number>${escapeXml(vendor.contactDetails)}</Number>` +
    `</Dial></Response>`;

  const result = await createTwilioCall({
    accountSid: secrets.accountSid,
    authToken: secrets.authToken,
    to: customerPhone,
    from: secrets.voiceNumber,
    twiml,
  });

  return { status: result.status || 'queued', callSid: result.sid };
};
