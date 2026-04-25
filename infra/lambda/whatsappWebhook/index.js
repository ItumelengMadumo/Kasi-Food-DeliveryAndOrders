'use strict';

/**
 * whatsappWebhook Lambda Function
 *
 * Receives incoming Twilio WhatsApp messages via API Gateway and drives a
 * multi-step ordering session state machine for each customer+vendor pair.
 *
 * Session steps:
 *   START            → show greeting + numbered menu
 *   SELECTING_ITEMS  → parse item number / quantity, build cart
 *   CONFIRM_ORDER    → show cart summary, collect customer name
 *   PAYMENT          → collect payment method, create order in DynamoDB
 *   DONE             → (handled inline; session reset to START)
 *
 * Environment variables:
 *   TABLE_NAME               — DynamoDB table name (default: KasiMainTable)
 *   TWILIO_ACCOUNT_SID       — Twilio Account SID
 *   TWILIO_AUTH_TOKEN        — Twilio Auth Token
 *   TWILIO_WHATSAPP_FROM     — Twilio sender number (e.g. +14155238886)
 *   WEBHOOK_URL              — Public URL of this function (for signature validation)
 *   NOTIFICATION_LAMBDA_ARN  — ARN of sendWhatsAppNotification Lambda
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const https = require('https');
const crypto = require('crypto');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({});

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';
const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const NOTIFICATION_LAMBDA_ARN = process.env.NOTIFICATION_LAMBDA_ARN || '';

// ─── Twilio helpers ────────────────────────────────────────────────────────

/**
 * Validate an incoming Twilio webhook request signature.
 * Returns true if validation is disabled (credentials not configured).
 */
function validateTwilioSignature(headers, rawBody) {
  if (!WEBHOOK_URL || !TWILIO_AUTH_TOKEN) return true;

  const signature =
    headers['X-Twilio-Signature'] || headers['x-twilio-signature'] || '';
  if (!signature) return false;

  const params = new URLSearchParams(rawBody);
  const sortedKeys = [...params.keys()].sort();
  let str = WEBHOOK_URL;
  for (const key of sortedKeys) {
    str += key + (params.get(key) || '');
  }

  const expected = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(Buffer.from(str))
    .digest('base64');

  return signature === expected;
}

/**
 * Parse the URL-encoded form body that Twilio sends.
 * Returns { from, to, body, messageSid }.
 */
function parseFormBody(rawBody) {
  const params = new URLSearchParams(rawBody);
  return {
    from: (params.get('From') || '').replace('whatsapp:', ''),
    to: (params.get('To') || '').replace('whatsapp:', ''),
    body: params.get('Body') || '',
    messageSid: params.get('MessageSid') || '',
  };
}

/**
 * Send a WhatsApp message via Twilio REST API.
 */
function sendTwilioMessage(to, body) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.log('[whatsappWebhook] Twilio not configured — would reply to', to, ':', body);
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
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, sid: parsed.sid });
            } else {
              console.warn('[whatsappWebhook] Twilio send error:', parsed.message);
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

// ─── DynamoDB helpers ─────────────────────────────────────────────────────

/**
 * Look up a vendor by their WhatsApp number using GSI3-VendorByWhatsApp.
 */
async function getVendorByWhatsApp(whatsappNumber) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI3-VendorByWhatsApp',
      KeyConditionExpression: 'GSI3PK = :wn',
      ExpressionAttributeValues: { ':wn': whatsappNumber },
      Limit: 1,
    })
  );
  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Load the session for a (customerPhone, vendorId) pair.
 * Returns null if no session exists or if the session has expired.
 */
async function getSession(customerPhone, vendorId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `SESSION#${customerPhone}`,
        SK: `VENDOR#${vendorId}`,
      },
    })
  );
  if (!result.Item) return null;
  // Guard against stale sessions that TTL hasn't cleaned up yet
  const now = Math.floor(Date.now() / 1000);
  if (result.Item.expiresAt && result.Item.expiresAt < now) return null;
  return result.Item;
}

/**
 * Persist or overwrite a session record, resetting the 30-minute TTL.
 */
async function saveSession(customerPhone, vendorId, data) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `SESSION#${customerPhone}`,
        SK: `VENDOR#${vendorId}`,
        ...data,
        updatedAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      },
    })
  );
}

/**
 * Load available menu items for a vendor.
 */
async function getVendorMenu(vendorId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'available = :av',
      ExpressionAttributeValues: {
        ':pk': `VENDOR#${vendorId}`,
        ':sk': 'MENU#',
        ':av': true,
      },
    })
  );
  return (result.Items || []).map((item) => ({
    id: item.SK.replace('MENU#', ''),
    name: item.name,
    price: item.price,
    category: item.category || 'General',
  }));
}

/**
 * Write a new order (metadata + items) to DynamoDB using a transaction.
 */
async function createOrderInDb(vendorId, customerPhone, customerName, cart, paymentMethod, vendor) {
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  const subtotal = parseFloat(
    cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)
  );
  const isDelivery = paymentMethod === 'CASH_ON_DELIVERY';

  const transactItems = [
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `ORDER#${orderId}`,
          SK: 'METADATA',
          GSI1PK: `VENDOR#${vendorId}`,
          GSI1SK: `ORDER#${now}`,
          orderId,
          customerId: null,
          guestDetails: { name: customerName, phone: customerPhone },
          vendorId,
          status: 'PENDING',
          deliveryMethod: isDelivery ? 'DELIVERY' : 'PICKUP',
          deliveryFee: 0,
          subtotal,
          totalAmount: subtotal,
          platformFee: 0,
          paymentMethod,
          paymentStatus: 'PENDING',
          contactPhone: customerPhone,
          specialInstructions: null,
          hasBankAccount: vendor.hasBankAccount || false,
          source: 'WHATSAPP',
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  ];

  for (const cartItem of cart) {
    transactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `ORDER#${orderId}`,
          SK: `ITEM#${crypto.randomUUID()}`,
          orderId,
          menuItemId: cartItem.menuItemId,
          name: cartItem.name,
          price: cartItem.price,
          quantity: cartItem.quantity,
          createdAt: now,
        },
      },
    });
  }

  await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));

  return { orderId, subtotal, now };
}

/**
 * Asynchronously invoke the notification Lambda (fire-and-forget).
 */
async function invokeNotification(vendorId, orderId, cart, totalAmount, customerName) {
  if (!NOTIFICATION_LAMBDA_ARN) return;
  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: NOTIFICATION_LAMBDA_ARN,
        InvocationType: 'Event',
        Payload: JSON.stringify({
          vendorId,
          orderId,
          orderItems: cart,
          totalAmount,
          customerName,
        }),
      })
    );
  } catch (err) {
    console.warn('[whatsappWebhook] Failed to invoke notification lambda:', err.message);
  }
}

// ─── Message formatting helpers ───────────────────────────────────────────

function formatMenu(menuItems, vendorName) {
  let msg = `Welcome to *${vendorName}* 🍔\n\nHere's our menu:\n\n`;
  menuItems.forEach((item, i) => {
    msg += `${i + 1}. *${item.name}* — R${item.price.toFixed(2)}\n`;
  });
  msg +=
    '\nReply with the item *number* and quantity:\n' +
    '• *1* for one\n' +
    '• *1 x2* for two\n\n' +
    '_Reply *0* at any time to restart_';
  return msg;
}

function formatCart(cart) {
  if (cart.length === 0) return 'Your cart is empty.';
  let msg = '🛒 *Your cart:*\n';
  let total = 0;
  for (const item of cart) {
    const lineTotal = item.price * item.quantity;
    total += lineTotal;
    msg += `• ${item.name} x${item.quantity} = R${lineTotal.toFixed(2)}\n`;
  }
  msg += `\n*Total: R${total.toFixed(2)}*`;
  return msg;
}

// ─── State machine ────────────────────────────────────────────────────────

/**
 * Route the incoming message through the session state machine and
 * return the reply text.
 */
async function processMessage(customerPhone, vendor, session, messageText) {
  const vendorId = vendor.PK.replace('VENDOR#', '');
  const upperMsg = messageText.trim().toUpperCase();

  // Global reset commands
  if (upperMsg === '0' || upperMsg === 'RESTART' || upperMsg === 'MENU') {
    const menu = await getVendorMenu(vendorId);
    await saveSession(customerPhone, vendorId, {
      currentStep: 'SELECTING_ITEMS',
      cart: [],
      menuContext: menu,
    });
    return formatMenu(menu, vendor.name);
  }

  const step = session ? session.currentStep : 'START';

  // ── START / no session ──────────────────────────────────────────────────
  if (step === 'START' || !session) {
    const menu = await getVendorMenu(vendorId);
    if (menu.length === 0) {
      return `Welcome to *${vendor.name}*! 👋\nWe don't have any menu items available right now. Please try again later.`;
    }
    await saveSession(customerPhone, vendorId, {
      currentStep: 'SELECTING_ITEMS',
      cart: [],
      menuContext: menu,
    });
    return formatMenu(menu, vendor.name);
  }

  // ── SELECTING_ITEMS ─────────────────────────────────────────────────────
  if (step === 'SELECTING_ITEMS') {
    const cart = session.cart || [];
    const menuContext = session.menuContext || [];

    if (upperMsg === 'C' || upperMsg === 'CONFIRM') {
      if (cart.length === 0) {
        return 'Your cart is empty. Please add some items first.';
      }
      await saveSession(customerPhone, vendorId, {
        currentStep: 'CONFIRM_ORDER',
        cart,
        menuContext,
      });
      return (
        `${formatCart(cart)}\n\n` +
        'Please reply with your *full name* to confirm your order.\n' +
        '_(e.g. "Sipho Mokoena")_'
      );
    }

    if (upperMsg === 'R' || upperMsg === 'REMOVE') {
      if (cart.length === 0) return 'Your cart is already empty.';
      const newCart = cart.slice(0, -1);
      await saveSession(customerPhone, vendorId, {
        currentStep: step,
        cart: newCart,
        menuContext,
      });
      if (newCart.length === 0) {
        return '✅ Removed. Cart is now empty.\nReply with an item number to add items.';
      }
      return (
        `✅ Last item removed.\n\n${formatCart(newCart)}\n\n` +
        'Reply with item *number* to add more\n*C* to confirm • *R* to remove last item'
      );
    }

    // Parse "1", "1 x2", "1x2", "2 2"
    const match = messageText.trim().match(/^(\d+)\s*(?:x\s*)?(\d+)?$/i);
    if (!match) {
      return (
        '❌ I didn\'t understand that.\n\n' +
        'Reply with item *number* (e.g. *1* or *1 x2*)\n' +
        '*C* to confirm • *R* to remove last item • *0* to restart'
      );
    }

    const itemIndex = parseInt(match[1], 10) - 1;
    const quantity = parseInt(match[2] || '1', 10);

    if (itemIndex < 0 || itemIndex >= menuContext.length) {
      return `❌ Invalid item number. Please choose 1–${menuContext.length}.`;
    }
    if (quantity < 1 || quantity > 20) {
      return '❌ Quantity must be between 1 and 20.';
    }

    const selectedItem = menuContext[itemIndex];
    const existingIdx = cart.findIndex((c) => c.menuItemId === selectedItem.id);
    let newCart;
    if (existingIdx >= 0) {
      newCart = cart.map((c, i) =>
        i === existingIdx ? { ...c, quantity: c.quantity + quantity } : c
      );
    } else {
      newCart = [
        ...cart,
        {
          menuItemId: selectedItem.id,
          name: selectedItem.name,
          price: selectedItem.price,
          quantity,
        },
      ];
    }

    await saveSession(customerPhone, vendorId, {
      currentStep: step,
      cart: newCart,
      menuContext,
    });

    return (
      `✅ Added *${selectedItem.name}* x${quantity}\n\n` +
      `${formatCart(newCart)}\n\n` +
      'Reply with item *number* to add more\n*C* to confirm • *R* to remove last item • *0* to restart'
    );
  }

  // ── CONFIRM_ORDER ───────────────────────────────────────────────────────
  if (step === 'CONFIRM_ORDER') {
    const customerName = messageText.trim();
    if (!customerName || customerName.length < 2) {
      return 'Please reply with your *full name* to confirm the order.';
    }
    const cart = session.cart || [];
    await saveSession(customerPhone, vendorId, {
      currentStep: 'PAYMENT',
      cart,
      menuContext: session.menuContext,
      customerName,
    });
    return (
      `Thanks, *${customerName}*! 👋\n\n` +
      'How would you like to pay?\n\n' +
      '1. 💵 Cash on pickup\n' +
      '2. 🏦 EFT (Bank transfer)\n' +
      '3. 🚚 Cash on delivery\n\n' +
      'Reply with *1*, *2*, or *3*'
    );
  }

  // ── PAYMENT ─────────────────────────────────────────────────────────────
  if (step === 'PAYMENT') {
    let paymentMethod;
    if (upperMsg === '1') paymentMethod = 'CASH_ON_PICKUP';
    else if (upperMsg === '2') paymentMethod = 'EFT';
    else if (upperMsg === '3') paymentMethod = 'CASH_ON_DELIVERY';
    else {
      return 'Please reply with *1* (Cash on pickup), *2* (EFT), or *3* (Cash on delivery).';
    }

    const cart = session.cart || [];
    const customerName = session.customerName || 'Guest';

    try {
      const { orderId, subtotal } = await createOrderInDb(
        vendorId,
        customerPhone,
        customerName,
        cart,
        paymentMethod,
        vendor
      );

      // Reset session
      await saveSession(customerPhone, vendorId, {
        currentStep: 'START',
        cart: [],
        menuContext: [],
      });

      // Fire-and-forget: notify vendor
      await invokeNotification(vendorId, orderId, cart, subtotal, customerName);

      const shortId = orderId.slice(-6).toUpperCase();
      let confirmMsg =
        `✅ *Order Confirmed!*\n\n` +
        `Order #${shortId}\n\n` +
        `${formatCart(cart)}\n\n` +
        `Payment: *${paymentMethod.replace(/_/g, ' ')}*\n\n` +
        `We'll notify you when it's ready! 🙌\n\n` +
        `_Reply *0* to place a new order_`;

      if (paymentMethod === 'EFT' && vendor.bankDetails) {
        const bd = vendor.bankDetails;
        confirmMsg +=
          `\n\n🏦 *EFT Payment Details:*\n` +
          `Bank: ${bd.bankName}\n` +
          `Account: ${bd.accountNumber}\n` +
          `Holder: ${bd.accountHolder}\n` +
          `Branch code: ${bd.branchCode}\n` +
          `Reference: ORDER-${shortId}`;
      }

      return confirmMsg;
    } catch (err) {
      console.error('[whatsappWebhook] Order creation failed:', err);
      return (
        '❌ Sorry, we could not place your order. Please try again or contact us directly.\n\n' +
        '_Reply *0* to restart_'
      );
    }
  }

  // Fallback
  return 'Reply *0* to start a new order. 😊';
}

// ─── Lambda handler ───────────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log('whatsappWebhook event headers:', JSON.stringify(event.headers || {}));
  console.log('whatsappWebhook body (first 300 chars):', String(event.body || '').substring(0, 300));

  const emptyTwiml = {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: '<Response></Response>',
  };

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body || '';

    // Validate Twilio request signature
    if (!validateTwilioSignature(event.headers || {}, rawBody)) {
      console.warn('[whatsappWebhook] Invalid Twilio signature — rejecting request');
      return { statusCode: 403, body: 'Forbidden' };
    }

    const { from, to, body: messageBody, messageSid } = parseFormBody(rawBody);
    console.log(`[whatsappWebhook] Message from=${from} to=${to} sid=${messageSid}: ${messageBody}`);

    if (!from || !to || !messageBody) {
      return { statusCode: 400, body: 'Bad Request: missing From, To, or Body' };
    }

    // Look up vendor by the incoming "To" WhatsApp number
    const vendor = await getVendorByWhatsApp(to);
    if (!vendor) {
      console.warn(`[whatsappWebhook] No vendor found for number: ${to}`);
      return emptyTwiml;
    }

    const vendorId = vendor.PK.replace('VENDOR#', '');

    // Load session
    const session = await getSession(from, vendorId);

    // Drive the state machine
    const replyText = await processMessage(from, vendor, session, messageBody);

    // Send reply via Twilio REST API
    await sendTwilioMessage(from, replyText);

    // Return empty TwiML (reply was sent via REST, not TwiML)
    return emptyTwiml;
  } catch (err) {
    console.error('[whatsappWebhook] Unhandled error:', err);
    return emptyTwiml;
  }
};
