'use strict';

/**
 * initiatePayment Lambda
 *
 * Called by AppSync mutation: initiatePayment(orderId, provider)
 * Builds a signed redirect to PayFast or Ozow for a DIGITAL-payment order and
 * records the pending gateway reference on the order. Never returns gateway
 * secrets to the client — only the redirect URL.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { getPaymentSecrets } = require('../_shared/secrets');
const payfast = require('../_shared/payfast');
const ozow = require('../_shared/ozow');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || '';

exports.handler = async (event) => {
  console.log('initiatePayment event:', JSON.stringify(event, null, 2));

  const { orderId, provider } = event.arguments || event;
  if (!orderId) throw new Error('orderId is required');
  if (!provider || !['PAYFAST', 'OZOW'].includes(provider)) {
    throw new Error('provider must be PAYFAST or OZOW');
  }

  const orderResult = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' } })
  );
  if (!orderResult.Item) throw new Error(`Order ${orderId} not found`);
  const order = orderResult.Item;

  if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
    throw new Error(`Order is ${order.status} and can no longer be paid for`);
  }
  if (order.paymentStatus === 'PAID') {
    throw new Error('Order has already been paid');
  }

  const vendorResult = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `VENDOR#${order.vendorId}`, SK: 'PROFILE' } })
  );
  const vendor = vendorResult.Item;
  if (!vendor || !vendor.digitalPaymentsEnabled) {
    throw new Error('This vendor does not accept digital payments yet — pay on collection instead');
  }

  const secrets = await getPaymentSecrets();

  const returnUrl = `${FRONTEND_URL}/orders/${orderId}?payment=success`;
  const cancelUrl = `${FRONTEND_URL}/orders/${orderId}?payment=cancelled`;
  const errorUrl = `${FRONTEND_URL}/orders/${orderId}?payment=error`;

  let redirectUrl;
  let gatewayRef = order.paymentRef || orderId;

  if (provider === 'PAYFAST') {
    if (!secrets.payfastMerchantId || !secrets.payfastMerchantKey) {
      throw new Error('PayFast is not configured');
    }
    redirectUrl = payfast.buildPaymentRedirect({
      mode: secrets.payfastMode || 'sandbox',
      merchantId: secrets.payfastMerchantId,
      merchantKey: secrets.payfastMerchantKey,
      passphrase: secrets.payfastPassphrase || '',
      amount: order.totalAmount.toFixed(2),
      itemName: `Kasi Food Order ${order.orderNumber || orderId}`,
      itemDescription: `Payment ref ${order.paymentRef || orderId}`,
      paymentId: orderId,
      returnUrl,
      cancelUrl,
      notifyUrl: `${WEBHOOK_BASE_URL}/webhooks/payfast/itn`,
      customStr1: order.paymentRef || '',
      email: order.guestDetails?.email || '',
      nameFirst: (order.guestDetails?.name || '').split(' ')[0] || '',
      nameLast: (order.guestDetails?.name || '').split(' ').slice(1).join(' ') || '',
    });
  } else {
    if (!secrets.ozowSiteCode || !secrets.ozowPrivateKey || !secrets.ozowApiKey) {
      throw new Error('Ozow is not yet configured for this store');
    }
    const ozowResult = await ozow.requestPaymentUrl({
      mode: secrets.ozowMode || 'staging',
      apiKey: secrets.ozowApiKey,
      siteCode: secrets.ozowSiteCode,
      privateKey: secrets.ozowPrivateKey,
      amount: order.totalAmount.toFixed(2),
      transactionReference: orderId,
      bankReference: (order.orderNumber || orderId).toString().slice(0, 20),
      customer: order.guestDetails?.name || '',
      cancelUrl,
      errorUrl,
      successUrl: returnUrl,
      notifyUrl: `${WEBHOOK_BASE_URL}/webhooks/ozow/notify`,
      isTest: (secrets.ozowMode || 'staging') !== 'live',
    });
    redirectUrl = ozowResult.redirectUrl;
    gatewayRef = ozowResult.transactionId || gatewayRef;
  }

  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: 'METADATA' },
      UpdateExpression:
        'SET paymentStatus = :ps, paymentMethod = :pm, paymentProvider = :pp, paymentGatewayRef = :pg, updatedAt = :ua',
      ExpressionAttributeValues: {
        ':ps': 'AWAITING_PAYMENT',
        ':pm': 'DIGITAL',
        ':pp': provider,
        ':pg': gatewayRef,
        ':ua': now,
      },
    })
  );

  return {
    provider,
    redirectUrl,
    paymentRef: order.paymentRef || orderId,
  };
};
