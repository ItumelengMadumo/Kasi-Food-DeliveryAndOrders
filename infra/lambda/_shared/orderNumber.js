'use strict';

/**
 * Shared helper for generating per-vendor, per-day, human-readable order numbers
 * that double as payment references (cash pickup, EFT, payment links).
 *
 * Format
 * ──────
 *   orderNumber : <PREFIX>-<YYMMDD>-<NNNN>   e.g. KOTA-260430-0017
 *   paymentRef  : <PREFIX><YYMMDD><NNNN>     e.g. KOTA2604300017   (≤20 chars, fits SA bank EFT refs)
 *
 * The sequence is generated atomically via a per-vendor / per-day counter row
 * in the single DynamoDB table:
 *   PK = VENDOR#<vendorId>
 *   SK = COUNTER#ORDER#<YYYYMMDD>
 *   seq = <Number>
 *
 * `ADD seq :one` is atomic and creates the counter row when missing, so two
 * concurrent createOrder invocations always receive distinct sequence numbers.
 */

const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const SA_TIMEZONE = 'Africa/Johannesburg';

/**
 * Returns the YYYYMMDD date string for "today" in South African time.
 * (We use SA time so the daily counter rolls over at local midnight.)
 *
 * @param {Date} [now] - Optional reference instant (used in tests).
 * @returns {string} 8-character date key, e.g. "20260430".
 */
function saDateKey(now = new Date()) {
  // Intl yields parts in the requested timezone; assemble to YYYYMMDD.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  return `${y}${m}${d}`;
}

/**
 * Derive a 4–6 letter uppercase prefix from a business name.
 * Strips non-alpha, takes first 4 chars, pads with 'X' if shorter than 4.
 *
 * @param {string} businessName
 * @returns {string} 4-character uppercase prefix.
 */
function derivePrefix(businessName) {
  if (!businessName) return 'KASI';
  const cleaned = String(businessName)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (cleaned.length >= 4) return cleaned.slice(0, 4);
  return (cleaned + 'XXXX').slice(0, 4);
}

/**
 * Pad a sequence number to a fixed width with leading zeros.
 * @param {number} seq
 * @param {number} [width=4]
 * @returns {string}
 */
function padSeq(seq, width = 4) {
  return String(seq).padStart(width, '0');
}

/**
 * Build the customer-facing orderNumber + bank-friendly paymentRef.
 *
 * @param {string} prefix    Vendor refPrefix (e.g. "KOTA")
 * @param {string} dateKey   YYYYMMDD (e.g. "20260430")
 * @param {number} seq       Per-vendor / per-day sequence (1, 2, 3, ...)
 * @returns {{ orderNumber: string, paymentRef: string }}
 */
function buildOrderNumber(prefix, dateKey, seq) {
  const yymmdd = dateKey.slice(2); // strip century → "260430"
  const seqStr = padSeq(seq, 4);
  const orderNumber = `${prefix}-${yymmdd}-${seqStr}`;
  const paymentRef = `${prefix}${yymmdd}${seqStr}`;
  return { orderNumber, paymentRef };
}

/**
 * Atomically increment the per-vendor / per-day counter and return the
 * full {orderNumber, paymentRef, seq, dateKey} bundle.
 *
 * @param {object} ddb       DynamoDBDocumentClient
 * @param {string} tableName
 * @param {string} vendorId
 * @param {string} prefix    Vendor.refPrefix
 * @param {Date}   [now]
 */
async function generateOrderNumber(ddb, tableName, vendorId, prefix, now = new Date()) {
  if (!vendorId) throw new Error('vendorId is required');
  if (!prefix) throw new Error('prefix is required');
  const dateKey = saDateKey(now);

  const result = await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `VENDOR#${vendorId}`,
        SK: `COUNTER#ORDER#${dateKey}`,
      },
      UpdateExpression: 'ADD seq :one SET updatedAt = :ua',
      ExpressionAttributeValues: {
        ':one': 1,
        ':ua': now.toISOString(),
      },
      ReturnValues: 'UPDATED_NEW',
    })
  );

  const seq = Number(result.Attributes?.seq || 1);
  const { orderNumber, paymentRef } = buildOrderNumber(prefix, dateKey, seq);
  return { orderNumber, paymentRef, seq, dateKey };
}

module.exports = {
  SA_TIMEZONE,
  saDateKey,
  derivePrefix,
  padSeq,
  buildOrderNumber,
  generateOrderNumber,
};
