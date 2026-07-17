'use strict';

/**
 * PayFast signature + redirect helpers.
 *
 * Signature algorithm (per PayFast's own reference implementations, e.g.
 * github.com/PayFast/mod-whmcs):
 *   1. Take the fields in the order they were added to the payload (NOT
 *      alphabetical) and skip `signature` itself. Unlike ITN validation,
 *      the outbound redirect signature INCLUDES every field even when its
 *      value is an empty string — PayFast's own modules never skip fields,
 *      they just urlencode(trim($val)) whatever is there.
 *   2. URL-encode each value using PHP's urlencode() semantics (spaces as
 *      `+`, and `! ' ( ) *  ~` percent-escaped, which JS encodeURIComponent
 *      leaves untouched), join as `key=value&key=value`.
 *   3. If a passphrase is configured, append `&passphrase=<encoded passphrase>`.
 *   4. MD5 hex digest of the resulting string.
 *
 * ITN verification (verifyItnSignature) skips fields PayFast didn't send at
 * all, since the received field set is whatever PayFast's POST body contains.
 */

const crypto = require('crypto');

const PAYFAST_SANDBOX_HOST = 'sandbox.payfast.co.za';
const PAYFAST_LIVE_HOST = 'www.payfast.co.za';

/** PHP urlencode()-compatible encoding — encodeURIComponent leaves `! ' ( ) *` unescaped and `~` too; PHP escapes all of them. */
function pfEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E');
}

function generateSignature(orderedFields, passphrase, { skipEmpty = false } = {}) {
  const parts = [];
  for (const [key, value] of orderedFields) {
    if (key === 'signature') continue;
    if (value === undefined || value === null) continue;
    if (skipEmpty && value === '') continue;
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
  // Every field is included with an empty-string default (never omitted) —
  // matching PayFast's own reference implementations, whose signature loop
  // never skips a field, it just encodes whatever trim($val) produces.
  const orderedFields = [
    ['merchant_id', merchantId || ''],
    ['merchant_key', merchantKey || ''],
    ['return_url', returnUrl || ''],
    ['cancel_url', cancelUrl || ''],
    ['notify_url', notifyUrl || ''],
    ['name_first', nameFirst || ''],
    ['name_last', nameLast || ''],
    ['email_address', email || ''],
    ['m_payment_id', paymentId || ''],
    ['amount', amount || ''],
    ['item_name', itemName || ''],
    ['item_description', itemDescription || ''],
    ['custom_str1', customStr1 || ''],
  ];

  const signature = generateSignature(orderedFields, passphrase);

  const params = new URLSearchParams();
  for (const [key, value] of orderedFields) {
    params.append(key, value);
  }
  params.append('signature', signature);

  return `https://${hostForMode(mode)}/eng/process?${params.toString()}`;
}

/** Verifies an ITN POST body (as an ordered array of [key, value] pairs). */
function verifyItnSignature(orderedFields, passphrase, receivedSignature) {
  const computed = generateSignature(orderedFields, passphrase, { skipEmpty: true });
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
