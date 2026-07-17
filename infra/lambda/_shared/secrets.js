'use strict';

/**
 * Cached Secrets Manager reader for payment gateway credentials.
 * The secret is JSON-shaped: see infra/cdk/lib/kasi-stack.ts for the fields.
 */

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({});

let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getPaymentSecrets() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  const secretId = process.env.PAYMENTS_SECRET_ARN;
  if (!secretId) throw new Error('PAYMENTS_SECRET_ARN is not configured');

  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  cached = JSON.parse(result.SecretString || '{}');
  cachedAt = now;
  return cached;
}

module.exports = { getPaymentSecrets };
