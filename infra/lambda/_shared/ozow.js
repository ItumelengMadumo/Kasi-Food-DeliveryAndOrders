'use strict';

/**
 * Ozow HashCheck + payment-request helpers.
 *
 * Algorithm (per Ozow's published API integration guide):
 *   1. Concatenate the relevant field VALUES (empty string for missing) in a
 *      fixed, documented order.
 *   2. Append the merchant's private key to the end of that string.
 *   3. Lowercase the entire concatenation.
 *   4. SHA512 hex digest.
 *
 * Request-hash field order: SiteCode, CountryCode, CurrencyCode, Amount,
 * TransactionReference, BankReference, Optional1-5, Customer, CancelUrl,
 * ErrorUrl, SuccessUrl, NotifyUrl, IsTest.
 *
 * Notify/callback-hash field order: SiteCode, TransactionId,
 * TransactionReference, Amount, Status.
 *
 * NOTE: Ozow does not publish a universal sandbox account — verify this
 * against the current docs in your Ozow merchant dashboard before relying on
 * it with real test credentials.
 */

const crypto = require('crypto');

const OZOW_STAGING_API = 'https://stagingapi.ozow.com/PostPaymentRequest';
const OZOW_LIVE_API = 'https://api.ozow.com/PostPaymentRequest';

function apiUrlForMode(mode) {
  return mode === 'live' ? OZOW_LIVE_API : OZOW_STAGING_API;
}

function hashFromValues(values, privateKey) {
  const str =
    values.map((v) => (v === undefined || v === null ? '' : String(v))).join('') +
    privateKey;
  return crypto.createHash('sha512').update(str.toLowerCase()).digest('hex');
}

const REQUEST_FIELD_ORDER = [
  'siteCode',
  'countryCode',
  'currencyCode',
  'amount',
  'transactionReference',
  'bankReference',
  'optional1',
  'optional2',
  'optional3',
  'optional4',
  'optional5',
  'customer',
  'cancelUrl',
  'errorUrl',
  'successUrl',
  'notifyUrl',
  'isTest',
];

const NOTIFY_FIELD_ORDER = ['siteCode', 'transactionId', 'transactionReference', 'amount', 'status'];

function buildRequestHash(fields, privateKey) {
  return hashFromValues(
    REQUEST_FIELD_ORDER.map((k) => fields[k]),
    privateKey
  );
}

function buildNotifyHash(fields, privateKey) {
  return hashFromValues(
    NOTIFY_FIELD_ORDER.map((k) => fields[k]),
    privateKey
  );
}

/**
 * Calls Ozow's PostPaymentRequest API and returns the hosted payment URL.
 * Requires fetch (available in Node 18+/20 Lambda runtime).
 */
async function requestPaymentUrl({
  mode,
  apiKey,
  siteCode,
  privateKey,
  amount,
  transactionReference,
  bankReference,
  customer,
  cancelUrl,
  errorUrl,
  successUrl,
  notifyUrl,
  isTest,
}) {
  const fields = {
    siteCode,
    countryCode: 'ZA',
    currencyCode: 'ZAR',
    amount,
    transactionReference,
    bankReference,
    optional1: '',
    optional2: '',
    optional3: '',
    optional4: '',
    optional5: '',
    customer: customer || '',
    cancelUrl,
    errorUrl,
    successUrl,
    notifyUrl,
    isTest: isTest ? 'true' : 'false',
  };

  const hashCheck = buildRequestHash(fields, privateKey);

  const payload = {
    siteCode: fields.siteCode,
    countryCode: fields.countryCode,
    currencyCode: fields.currencyCode,
    amount: fields.amount,
    transactionReference: fields.transactionReference,
    bankReference: fields.bankReference,
    optional1: fields.optional1,
    optional2: fields.optional2,
    optional3: fields.optional3,
    optional4: fields.optional4,
    optional5: fields.optional5,
    customer: fields.customer,
    cancelUrl: fields.cancelUrl,
    errorUrl: fields.errorUrl,
    successUrl: fields.successUrl,
    notifyUrl: fields.notifyUrl,
    isTest: fields.isTest,
    hashCheck,
  };

  const res = await fetch(apiUrlForMode(mode), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ApiKey: apiKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.errorMessage || !body.url) {
    throw new Error(
      `Ozow payment request failed: ${body.errorMessage || res.statusText || 'unknown error'}`
    );
  }

  return { redirectUrl: body.url, transactionId: body.transactionId || null };
}

module.exports = {
  buildRequestHash,
  buildNotifyHash,
  requestPaymentUrl,
  apiUrlForMode,
  REQUEST_FIELD_ORDER,
  NOTIFY_FIELD_ORDER,
};
