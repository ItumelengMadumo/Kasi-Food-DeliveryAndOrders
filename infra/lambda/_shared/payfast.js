'use strict';

/**
 * PayFast signature + redirect helpers.
 *
 * Signature algorithm (per PayFast's published integration guide):
 *   1. Take the fields in the order they were added to the payload (NOT
 *      alphabetical), skip any that are empty/undefined, and skip `signature`.
 *   2. URL-encode each value (spaces as `+`), join as `key=value&key=value`.
 *   3. If a passphrase is configured, append `&passphrase=<encoded passphrase>`.
 *   4. MD5 hex digest of the resulting string.
 *
 * The same routine is used to build the outbound redirect signature and to
 * verify an inbound ITN signature — ITN verification must use the fields in
 * the order PayFast POSTed them (URLSearchParams preserves that order).
 */

const crypto = require('crypto');

const PAYFAST_SANDBOX_HOST = 'sandbox.payfast.co.za';
const PAYFAST_LIVE_HOST = 'www.payfast.co.za';

function pfEncode(value) {
  return encodeURIComponent(String(value).trim()).replace(/%20/g, '+');
}

function generateSignature(orderedFields, passphrase) {
  const parts = [];
  for (const [key, value] of orderedFields) {
    if (key === 'signature') continue;
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  let str = parts.join('&');
  if (passphrase) {
    str += `&passphrase=${pfEncode(passphrase)}`;
  }
  return crypto.createHash('md5').update(str).digest('hex');
}

function hostForMode(mode) {
  return mode === 'live' ? PAYFAST_LIVE_HOST : PAYFAST_SANDBOX_HOST;
}

function buildPaymentRedirect({
  mode,
  merchantId,
  merchantKey,
  passphrase,
  amount,
  itemName,
  itemDescription,
  paymentId,
  returnUrl,
  cancelUrl,
  notifyUrl,
  customStr1,
  email,
  nameFirst,
  nameLast,
}) {
  const orderedFields = [
    ['merchant_id', merchantId],
    ['merchant_key', merchantKey],
    ['return_url', returnUrl],
    ['cancel_url', cancelUrl],
    ['notify_url', notifyUrl],
    ['name_first', nameFirst],
    ['name_last', nameLast],
    ['email_address', email],
    ['m_payment_id', paymentId],
    ['amount', amount],
    ['item_name', itemName],
    ['item_description', itemDescription],
    ['custom_str1', customStr1],
  ];

  const signature = generateSignature(orderedFields, passphrase);

  const params = new URLSearchParams();
  for (const [key, value] of orderedFields) {
    if (value !== undefined && value !== null && value !== '') params.append(key, value);
  }
  params.append('signature', signature);

  return `https://${hostForMode(mode)}/eng/process?${params.toString()}`;
}

/** Verifies an ITN POST body (as an ordered array of [key, value] pairs). */
function verifyItnSignature(orderedFields, passphrase, receivedSignature) {
  const computed = generateSignature(orderedFields, passphrase);
  return computed === receivedSignature;
}

module.exports = {
  generateSignature,
  buildPaymentRedirect,
  verifyItnSignature,
  hostForMode,
  PAYFAST_SANDBOX_HOST,
  PAYFAST_LIVE_HOST,
};
